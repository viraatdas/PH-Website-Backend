import {
	registerDecorator,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	ValidationArguments
} from 'class-validator';
import { Member } from '../models/member';

@ValidatorConstraint({ async: true })
export class IsMemberAlreadyExistConstraint implements ValidatorConstraintInterface {
	async validate(value: any, args: ValidationArguments) {
		const member = await Member.findOne({ email: value }).exec();
		return member ? false : true;
	}
}

export function IsMemberAlreadyExist(validationOptions?: ValidationOptions) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsMemberAlreadyExistConstraint
		});
	};
}
