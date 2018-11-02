import { JsonController, Get } from 'routing-controllers';

@JsonController()
export class Controller {
	@Get('/')
	public findAll() {
		return 'It works';
	}
}
