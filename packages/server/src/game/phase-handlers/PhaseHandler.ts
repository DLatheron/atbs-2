import { Phase } from '@atbs/shared-data';

export class PhaseHandler {
	abstract get phase(): Phase;

	get acceptingClients(): boolean {
		return false;
	}
}
