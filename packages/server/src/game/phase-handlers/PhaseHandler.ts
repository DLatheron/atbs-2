import { Phase } from '@atbs/shared-data';

export abstract class PhaseHandler {
	abstract get phase(): Phase;

	get acceptingClients(): boolean {
		return false;
	}
}
