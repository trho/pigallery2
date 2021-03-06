import {JobProgressDTO} from '../../../../common/entities/job/JobProgressDTO';
import {JobDTO} from '../../../../common/entities/job/JobDTO';
import {JobLastRunDTO} from '../../../../common/entities/job/JobLastRunDTO';

export interface IJob<T> extends JobDTO {
  Name: string;
  Supported: boolean;
  Progress: JobProgressDTO;
  LastRuns: { [key: string]: JobLastRunDTO };

  start(config: T, OnFinishCB: () => void): Promise<void>;

  stop(): void;

  toJSON(): JobDTO;
}
