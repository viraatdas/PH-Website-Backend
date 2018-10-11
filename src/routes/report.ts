import * as express from 'express';
// import * as paginate from 'express-paginate';
import { isEmail } from 'validator';
import { ObjectId, Db } from 'mongodb';
import { Event } from '../models/event';
import { Member, IMemberModel } from '../models/member';
import { auth, hasPermissions } from '../middleware/passport';
import {
    successRes,
    errorRes,
    sendAccountCreatedEmail,
    hasPermission
} from '../utils';
export const router = express.Router();

// TODO: Add auth to routes
// TODO: Add permissions to routes

function formatDates(aggr: any[]): Object {
    var res = {};

    for (var i = 0; i < aggr.length; i++) {
        if (aggr[i]._id.month < 10) {
            res[`0${aggr[i]._id.month}/${aggr[i]._id.year}`] = aggr[i].count;
        } else {
            res[`${aggr[i]._id.month}/${aggr[i]._id.year}`] = aggr[i].count;
        }
    }
    return res;
}

function monthDiff(d1, d2): number {
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth() + 1;
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
}

router.get('/members', async (req, res, next) => {
    try {
        let majorsAggregationResult = await Member.aggregate([{ $match: { major: { $ne: null } } }, { $sortByCount: "$major" }], function (err, members) {
            if (err) {
                throw err;
            }
        });

        //format the response
        const majorData = {};

        for (let i = 0; i < majorsAggregationResult.length; i++) {
            // Format the major name to be the first letters of every word
            // if the major is more than two words
            // ex: Computer Science -> CS
            var individualWords = majorsAggregationResult[i]._id.split(" ");
            if (individualWords.length >= 2) {
                var shortenedMajorName = "";
                for (var j = 0; j < individualWords.length; j++) {
                    shortenedMajorName += individualWords[j][0];
                }

                majorData[shortenedMajorName] = majorsAggregationResult[i].count;
            } else {
                majorData[majorsAggregationResult[i]._id] = majorsAggregationResult[i].count;
            }
        }

        let classAggregationResult = await Member.aggregate([{ $match: { graduationYear: { $in: [2019, 2020, 2021, 2022] } } }, { $group: { "_id": "$graduationYear", "count": { "$sum": 1 } } }, { $sort: { _id: -1 } }], function (err, members) {
            if (err) {
                throw err;
            }
        });

        //format the response
        const classData = {
            2022: 0,
            2021: 0,
            2020: 0,
            2019: 0
        };

        for (let i = 0; i < classAggregationResult.length; i++) {
            classData[classAggregationResult[i]._id] = classAggregationResult[i].count;
        }

        let numPeoplePerDateJoinedAggregationResult = await Member.aggregate([{ $addFields: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } } }, { $group: { _id: { month: "$month", year: "$year" }, count: { $sum: 1 } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }], function (err, members) {
            if (err) {
                throw err;
            }
        });

        const numPeoplePerDateJoinedData = formatDates(numPeoplePerDateJoinedAggregationResult);

        // Cumulative Date Joined Data
        for (var i = 1; i < numPeoplePerDateJoinedAggregationResult.length; i++) {
            numPeoplePerDateJoinedAggregationResult[i].count += numPeoplePerDateJoinedAggregationResult[i - 1].count;
        }

        const cumulativeDateJoinedData = { "07/16": 0, ...formatDates(numPeoplePerDateJoinedAggregationResult) };

        let membersEventAttendanceAggregationResult = await Member.aggregate([{ $match: { events: { $ne: null } } }, { $group: { "_id": { numEvents: { $size: "$events" } }, "count": { "$sum": 1 } } }, { $sort: { _id: 1 } }], function (err, members) {
            if (err) {
                throw err;
            }
        });

        const membersEventAttendanceData = {};

        for (let i = 0; i < membersEventAttendanceAggregationResult.length; i++) {
            if (membersEventAttendanceAggregationResult[i]._id.numEvents >= 10) {
                if (!membersEventAttendanceData[">10"]) {
                    membersEventAttendanceData[">10"] = membersEventAttendanceAggregationResult[i].count;
                } else {
                    membersEventAttendanceData[">10"] += membersEventAttendanceAggregationResult[i].count;
                }
            } else {
                membersEventAttendanceData[membersEventAttendanceAggregationResult[i]._id.numEvents] = membersEventAttendanceAggregationResult[i].count;
            }
        }

        let eventAttendancePerMonthAggregationResult = await Event.aggregate([{ $match: { members: { $ne: null } } }, { $addFields: { month: { $month: "$eventTime" }, year: { $year: "$eventTime" }, numAtten: { $size: "$members" } } }, { $group: { _id: { month: "$month", year: "$year" }, count: { $sum: "$numAtten" } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }], function (err, members) {
            if (err) {
                throw err;
            }
        });

        const eventAttendancePerMonthData = formatDates(eventAttendancePerMonthAggregationResult);

        return successRes(res, {
            classData,
            majorData,
            numPeoplePerDateJoinedData,
            cumulativeDateJoinedData,
            membersEventAttendanceData,
            eventAttendancePerMonthData
        });
    } catch (error) {
        return errorRes(res, 500, error);
    }
});

router.get('/event/:id', async (req, res, next) => {
    try {
        //Get individual event
        if (!ObjectId.isValid(req.params.id))
            return errorRes(res, 400, 'Invalid event ID');
        const event = await Event.findById(req.params.id)
            .populate({
                path: 'members',
                model: Member
            })

        const eventName = event.name;

        const majorsAggregationResult = await Member.aggregate([{ $match: { _id: { $in: event.members }, major: { $ne: null } } }, { $sortByCount: "$major" }], function (err, members) {
            if (err) {
                throw err;
            }
        })

        //format the response
        const majorData = {
            "CS": 0,
            "CIT": 0,
            "FYE": 0,
            "ECE": 0,
            "EE": 0,
            "Math": 0,
            "CGT": 0,
            "ME": 0,
            "Other": 0
        };

        for (let i = 0; i < majorsAggregationResult.length; i++) {
            // Format the major name to be the first letters of every word
            // if the major is more than two words
            // ex: Computer Science -> CS
            var individualWords = majorsAggregationResult[i]._id.split(" ");
            if (individualWords.length >= 2) {
                var shortenedMajorName = "";
                for (var j = 0; j < individualWords.length; j++) {
                    shortenedMajorName += individualWords[j][0];
                }

                majorData[shortenedMajorName] = majorsAggregationResult[i].count;
            } else {
                majorData[majorsAggregationResult[i]._id] = majorsAggregationResult[i].count;
            }
        }

        let classAggregationResult = await Member.aggregate([{ $match: { _id: { $in: event.members }, graduationYear: { $in: [2019, 2020, 2021, 2022] } } }, { $group: { "_id": "$graduationYear", "count": { "$sum": 1 } } }, { $sort: { _id: 1 } }], function (err, members) {
            if (err) {
                throw err;
            }
        });

        //format the response
        const classData = {
            2022: 0,
            2021: 0,
            2020: 0,
            2019: 0
        };

        for (let i = 0; i < classAggregationResult.length; i++) {
            classData[classAggregationResult[i]._id] = classAggregationResult[i].count;
        }

        const results = await Event.find({}, "_id eventTime").exec();
        var eventsBeforeIds: any[] = new Array();
        for (var i = 0; i < results.length; i++) {
            if (results[i].eventTime < event.eventTime) {
                eventsBeforeIds.push(new ObjectId(results[i]._id));
            }
        }

        let membersEventAttendanceAggregationResult = await Member.aggregate([{ $match: { _id: { $in: event.members } } }, { $addFields: { numEvents: { $size: { $filter: { input: "$events", as: "id", cond: { $in: ["$$id", eventsBeforeIds] } } } } } }, { $group: { "_id": { numEvents: "$numEvents" }, "count": { "$sum": 1 } } }, { $sort: { _id: 1 } }], function (err, members) {
            if (err) {
                throw err;
            }
        })

        const membersEventAttendanceData = {};

        for (let i = 0; i < membersEventAttendanceAggregationResult.length; i++) {
            if (membersEventAttendanceAggregationResult[i]._id.numEvents >= 10) {
                if (!membersEventAttendanceData[">10"]) {
                    membersEventAttendanceData[">10"] = membersEventAttendanceAggregationResult[i].count;
                } else {
                    membersEventAttendanceData[">10"] += membersEventAttendanceAggregationResult[i].count;
                }
            } else {
                membersEventAttendanceData[membersEventAttendanceAggregationResult[i]._id.numEvents] = membersEventAttendanceAggregationResult[i].count;
            }
        }

        return successRes(res, {
            eventName,
            majorData,
            classData,
            membersEventAttendanceData
        });
    } catch (error) {
        return errorRes(res, 500, error);
    }
});