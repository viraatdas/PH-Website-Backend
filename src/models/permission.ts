import { Document, Schema, model } from 'mongoose';
import { IMemberDocument } from './member';

export interface IPermissionModel extends Document {
	name: string;
	description: string;
	members: {
		member: IMemberDocument;
		recordedBy: IMemberDocument;
		dateAdded: Date;
	}[];
}

const schema = new Schema(
	{
		name: {
			type: String,
			required: true
		},
		description: {
			type: String,
			required: true
		},
		members: [
			{
				member: {
					type: Schema.Types.ObjectId,
					ref: 'Member'
				},
				recordedBy: {
					type: Schema.Types.ObjectId,
					ref: 'Member'
				},
				dateAdded: Date
			}
		]
	},
	{ timestamps: true }
);

export const Permission = model<IPermissionModel>(
	'Permission',
	schema,
	'permissions'
);
