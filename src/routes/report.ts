import * as express from 'express';
// import * as paginate from 'express-paginate';
import { isEmail } from 'validator';
import { ObjectId, Db } from 'mongodb';
import { Event } from '../models/event';
import { Member, IMemberModel } from '../models/member';
import { auth, hasPermissions } from '../middleware/passport';
import { successRes, errorRes, sendAccountCreatedEmail, hasPermission } from '../utils';
export const router = express.Router();

// TODO: Add auth to routes
// TODO: Add permissions to routes

function formatDates(aggr: any[]): object {
	const res = {};

	for (const date of aggr) {
		if (date._id.month < 10) {
			res[`0${date._id.month}/${date._id.year}`] = date.count;
		} else {
			res[`${date._id.month}/${date._id.year}`] = date.count;
		}
	}
	return res;
}

router.get('/members', async (req, res, next) => {
	try {
		const result = await Promise.all([
			Member.aggregate([
				{
					$facet: {
						major: [{ $match: { major: { $ne: null } } }, { $sortByCount: '$major' }],
						class: [
							{ $match: { graduationYear: { $in: [2019, 2020, 2021, 2022] } } },
							{ $group: { _id: '$graduationYear', count: { $sum: 1 } } },
							{ $sort: { _id: -1 } }
						],
						numPeoplePerDateJoined: [
							{
								$addFields: {
									month: { $month: '$createdAt' },
									year: { $year: '$createdAt' }
								}
							},
							{
								$group: { _id: { month: '$month', year: '$year' }, count: { $sum: 1 } }
							},
							{ $sort: { '_id.year': 1, '_id.month': 1 } }
						],
						membersEventAttendance: [
							{ $match: { events: { $ne: null } } },
							{
								$group: { _id: { numEvents: { $size: '$events' } }, count: { $sum: 1 } }
							},
							{ $sort: { _id: 1 } }
						]
					}
				}
			]).exec(),
			// Event attendance per month
			Event.aggregate([
				{ $match: { members: { $ne: null } } },
				{
					$addFields: {
						month: { $month: '$eventTime' },
						year: { $year: '$eventTime' },
						numAtten: { $size: '$members' }
					}
				},
				{
					$group: {
						_id: { month: '$month', year: '$year' },
						count: { $sum: '$numAtten' }
					}
				},
				{ $sort: { '_id.year': 1, '_id.month': 1 } }
			]).exec()
		]);

		console.log('res', result[1]);
		// format the response
		const majorData = {};
		const majorsAggregationResult = result[0][0].major;
		for (const major of majorsAggregationResult) {
			// Format the major name to be the first letters of every word
			// if the major is more than two words
			// ex: Computer Science -> CS
			const individualWords = major._id.split(' ');
			if (individualWords.length >= 2) {
				let shortenedMajorName = '';
				for (const word of individualWords) {
					shortenedMajorName += word[0];
				}

				majorData[shortenedMajorName] = major.count;
			} else {
				majorData[major._id] = major.count;
			}
		}

		// format the response
		const classData = {
			2022: 0,
			2021: 0,
			2020: 0,
			2019: 0
		};

		const classAggregationResult = result[0][0].class;
		for (const classElement of classAggregationResult) {
			classData[classElement._id] = classElement.count;
		}

		const numPeoplePerDateJoinedAggregationResult = result[0][0].numPeoplePerDateJoined;
		const numPeoplePerDateJoinedData = formatDates(numPeoplePerDateJoinedAggregationResult);

		// Cumulative Date Joined Data
		for (let i = 1; i < numPeoplePerDateJoinedAggregationResult.length; i++) {
			numPeoplePerDateJoinedAggregationResult[i].count +=
				numPeoplePerDateJoinedAggregationResult[i - 1].count;
		}

		const cumulativeDateJoinedData = {
			'07/16': 0,
			...formatDates(numPeoplePerDateJoinedAggregationResult)
		};

		const membersEventAttendanceData = [];
		const membersEventAttendanceAggregationResult = result[0][0].membersEventAttendance;

		for (const eventAttendance of membersEventAttendanceAggregationResult) {
			if (eventAttendance._id.numEvents >= 10) {
				if (!membersEventAttendanceData['>10']) {
					membersEventAttendanceData['>10'] = eventAttendance.count;
				} else {
					membersEventAttendanceData['>10'] += eventAttendance.count;
				}
			} else {
				membersEventAttendanceData[eventAttendance._id.numEvents] = eventAttendance.count;
			}
		}

		const eventAttendancePerMonthAggregationResult = result[1];
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
		// Get individual event
		if (!ObjectId.isValid(req.params.id)) return errorRes(res, 400, 'Invalid event ID');

		const eventAndEventBeforeIds = await Promise.all([
			Event.findById(req.params.id)
				.populate({
					path: 'members',
					model: Member
				})
				.exec(),
			Event.find({}, '_id eventTime').exec()
		]);

		const event = eventAndEventBeforeIds[0];
		const eventName = event.name;

		const eventIdsAndTimes = eventAndEventBeforeIds[1];
		const eventsBeforeIds: any[] = new Array();
		for (const eventIdAndTime of eventIdsAndTimes) {
			if (eventIdAndTime.eventTime < event.eventTime) {
				eventsBeforeIds.push(new ObjectId(eventIdAndTime._id));
			}
		}

		const result = await Member.aggregate([
			{
				$facet: {
					major: [
						{ $match: { _id: { $in: event.members }, major: { $ne: null } } },
						{ $sortByCount: '$major' }
					],
					class: [
						{
							$match: {
								_id: { $in: event.members },
								graduationYear: { $in: [2019, 2020, 2021, 2022] }
							}
						},
						{ $group: { _id: '$graduationYear', count: { $sum: 1 } } },
						{ $sort: { _id: 1 } }
					],
					membersEventAttendance: [
						{ $match: { _id: { $in: event.members } } },
						{
							$addFields: {
								numEvents: {
									$size: {
										$filter: {
											input: '$events',
											as: 'id',
											cond: { $in: ['$$id', eventsBeforeIds] }
										}
									}
								}
							}
						},
						{ $group: { _id: { numEvents: '$numEvents' }, count: { $sum: 1 } } },
						{ $sort: { _id: 1 } }
					]
				}
			}
		]).exec();

		// format the response
		const majorData = {
			CS: 0,
			CIT: 0,
			FYE: 0,
			ECE: 0,
			EE: 0,
			Math: 0,
			CGT: 0,
			ME: 0,
			Other: 0
		};
		const majorsAggregationResult = result[0].major;

		for (const major of majorsAggregationResult) {
			// Format the major name to be the first letters of every word
			// if the major is more than two words
			// ex: Computer Science -> CS
			const individualWords = major._id.split(' ');
			if (individualWords.length >= 2) {
				let shortenedMajorName = '';
				for (const word of individualWords) {
					shortenedMajorName += word[0];
				}

				majorData[shortenedMajorName] = major.count;
			} else {
				majorData[major._id] = major.count;
			}
		}

		// format the response
		const classData = {
			2022: 0,
			2021: 0,
			2020: 0,
			2019: 0
		};
		const classAggregationResult = result[0].class;

		for (const classElement of classAggregationResult) {
			classData[classElement._id] = classElement.count;
		}

		const membersEventAttendanceData = {};
		const membersEventAttendanceAggregationResult = result[0].membersEventAttendance;

		for (const eventAttendance of membersEventAttendanceAggregationResult) {
			if (eventAttendance._id.numEvents >= 10) {
				if (!membersEventAttendanceData['>10']) {
					membersEventAttendanceData['>10'] = eventAttendance.count;
				} else {
					membersEventAttendanceData['>10'] += eventAttendance.count;
				}
			} else {
				membersEventAttendanceData[eventAttendance._id.numEvents] = eventAttendance.count;
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
