import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as GoogleCloudStorage from '@google-cloud/storage';
import * as Multer from 'multer';
import { IMemberModel, Member, MemberDto } from '../models/member';
import { Permission, IPermissionModel } from '../models/permission';
import CONFIG from '../config';
export * from './email';

const storage = new GoogleCloudStorage({
	projectId: 'purduehackers-212319',
	credentials: {
		private_key:
			'-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCYAxdq+NnykhXz\nTGRJDBHtCI1u2VNHrZOv8ga/rwPFFBV709TuYoD+lqzW0Y543OPlZt//jWgKnJJd\nDWG9tbZuRGCDWpcA2y05alAqIVl/2UZmSofKhZfSlcU6JQZqrHY6izToumPEPpd7\nTPo+UJyDiAl4NOaw5Sy8x/ryQVFZaMeqQxnhlRe2LPNWJlOfKBsU3G4urmziDYbC\n3GUXdKbH+G90I+TsRjraWmv/f7fem43lj4cNJjWaGZEF1CpJ3v3jiftafOGobtqZ\n5ohgUdMFzQnKUex6Fh9vcAzVt6FwvvmciNnhUtz7iCcd7KlhOIQpeS/wK5Por99J\nlKFs8t69AgMBAAECggEABQxSCMSYdRlfQgpbzwYBlzEp6tZ4xFabvJB5cBnFzEbg\nd8Sou5a12STz1HNDgfjQvXUiVzN0LKk9pK1ySee9vGe06AFoJluHYvK7rf2xiGQu\nYrmmGZZzwxO9Z8yDxaMe9TUn3dqvjK+ipDIB1XPwq3jAp8Djlr6yZgqJTbMLNCbd\nGdngYiDbbgmILr2fWF6v2Cr33958R1WNJiQXQvJGytOUqFztpT8/YwdEKsT/W/Sn\nxzTOJ/ZcmFcB+okrCvHLskxpmh1suoOI/csCeC0u9kvJyXYQVeTgDSiWbozBiVU2\nyawVN5nN08RVm6eH6+1rXI4SuuQFKmAELnIkVNas2QKBgQDU5w/Z01lY0eml5D8C\nXyjxJNbRMVRLOurE0M8kbPswBiNvH08px/HoHqAcHDCt4MVom3fSbXUJvhh6KPXL\n8TTQigXG5mTEc43X3qA/yT3G9pqH9wDfYNF73ZfoapXm3rz7gkxI4ajJyBMIlHj3\n+UVWAsivmyKiXkpYw7wlYxQ5OwKBgQC2yJcQKG+BeuYF8ZLaKrnthMsH4h1fT1Am\nt1QWGspftsdGuZ01+CNpGMNkrg1XgyDAYhENaUnImFiEozD9vTTaS4earbQ4sOtT\naFMxBQdBtfLuvaTfFq3ZfDhcamFgpaIvKmndfg/pbIKmLxNiVNS6dTBHkgSPrUNN\nNVoQObIIZwKBgAsmLoZRsxQbqgit8z7EjPhT3YwG8UsfQrwb0z0tF9pj9+cR1Ktz\ndQ+ayvet4j64zp2zxoqWgNKJye5bxsNvVjy1faf02MIQ6xSq6+lrOHj64QzNupX4\nFABQkmvxaPg2Id9p62TFrHkkqRqB6/PQcfkXHDtV/HJUTcBoP6oVjjGRAoGAQXa2\nI+NXjFgn6hkLL3f9/0OAM+KYAnq1iig+xWvy7zTXSk1QMPQeOpXT5UsxHBaqtDxr\nPxJmiqGFknugIECTnVtPxeZQlb1HiyfiI7xZTP+NclQZqIzG1w3WYcL3/VVVMO9P\n2zQ7Hq7uW/agSqd3SRCPqhJx78NuR0jEaOtBCCECgYEAzeaQfJDzu8fKl5bYEv3R\nqMg80J+RcJ4M6Q4LnTzM1lb/N4NaaFcNCWyCczOJQ6xQOsJhfCUmLam4GsLlKBzw\nLKwW2WPHM+s7Jw+7b63vXuxCaTZbG+SUlFQUyWFCo1Q7u2ZhCM6HNr/MVI8PPlce\nLSdW8PcbzyKB0c/WZMrbDLg=\n-----END PRIVATE KEY-----\n',
		client_email: 'websiteserver@purduehackers-212319.iam.gserviceaccount.com'
	}
	// keyFilename: 'purduehackers.json'
});

const bucket = storage.bucket(CONFIG.GC_BUCKET);

export const multer = Multer({
	storage: Multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024 // no larger than 5mb, you can change as needed.
	}
});

export const successRes = (res: Response, response: any) => res.json({ status: 200, response });

export const success = (response: any) => ({ status: 200, response });

export const errorRes = (res: Response, status: number, error: any) =>
	res.status(status).json({
		status,
		error
	});

// export const hasPermission = (user: IMemberModel, name: string) =>
// 	user.permissions.some(per => per.name === name || per.name === 'admin');

export const hasPermission = (user, name: string): boolean =>
	user &&
	user.permissions &&
	// (Object.keys(user).length !== 0 && user.constructor === Object) &&
	user.permissions.some(per => per.name === name || per.name === 'admin');

export const isAdmin = user => hasPermission(user, 'admin');

export const memberMatches = (user, id: ObjectId | string) =>
	user &&
	(hasPermission(user, 'admin') ||
		user._id === id ||
		(typeof user._id.equals === 'function' && user._id.equals(id)));

export const escapeRegEx = (str: string) =>
	str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

const dateToString = date =>
	new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		weekday: 'short'
	});

export const formatDate = date => {
	if (!date) return 'Current';
	const str = dateToString(date);
	return str !== 'Invalid Date' ? str : 'Current';
};

export function to<T, U = any>(
	promise: Promise<T>,
	errorExt?: object
): Promise<[T | null, U | null]> {
	return promise
		.then<[T, null]>((data: T) => [data, null])
		.catch<[null, U]>(err => {
			if (errorExt) Object.assign(err, errorExt);

			return [null, err];
		});
}

export const uploadToStorage = async (
	file: Express.Multer.File,
	folder: string,
	user: MemberDto
) => {
	if (!file) return 'No image file';
	else if (folder === 'pictures' && !file.originalname.match(/\.(jpg|jpeg|png|gif)$/i))
		return `File: ${file.originalname} is an invalid image type`;
	else if (folder === 'resumes' && !file.originalname.match(/\.(pdf)$/i))
		return `File: ${file.originalname} is an invalid image type`;

	const fileName = `${folder}/${user.email.replace('@', '_')}`;
	const fileUpload = bucket.file(fileName);

	return new Promise<string>((resolve, reject) => {
		const blobStream = fileUpload.createWriteStream({
			metadata: {
				contentType: file.mimetype,
				cacheControl: 'no-cache, max-age=0'
			}
		});

		blobStream.on('error', error => {
			console.error(error);
			reject('Something is wrong! Unable to upload at the moment.');
		});

		// blobStream.on('finish', () => {
		// 	// The public URL can be used to directly access the file via HTTP.
		// 	fileUpload.getMetadata().then(meta => resolve(meta['0'].mediaLink));
		// });

		blobStream.on('finish', () => {
			// The public URL can be used to directly access the file via HTTP.
			resolve(`https://storage.googleapis.com/${CONFIG.GC_BUCKET}/${fileName}`);
		});

		blobStream.end(file.buffer);
	});
};

export const addMemberToPermission = async (member, permission, user) =>
	Promise.all([
		Member.findByIdAndUpdate(
			member._id,
			{
				$push: {
					permissions: permission._id
				}
			},
			{ new: true }
		).exec(),
		Permission.findByIdAndUpdate(
			permission._id,
			{
				$push: {
					members: {
						member: member._id,
						recordedBy: user._id,
						dateAdded: new Date()
					}
				}
			},
			{ new: true }
		)
			.populate({
				path: 'members.member',
				model: Member
			})
			.populate({
				path: 'members.recordedBy',
				model: Member
			})
			.exec()
	]);

export const addMemberToPermissions = async (
	member: IMemberModel,
	permissions: IPermissionModel[],
	user
) => {
	let p;
	const perms = [];
	for (const permission of permissions) {
		[member, p] = await addMemberToPermission(member, permission, user);
		perms.push(p);
	}

	return [member, perms];
};
