import {ConfigTemplateEntry, DefaultsJobs} from '../../../../common/entities/job/JobDTO';
import * as path from 'path';
import * as util from 'util';
import {promises as fsp} from 'fs';
import {Job} from './Job';
import {JobProgressDTO} from '../../../../common/entities/job/JobProgressDTO';
import {ProjectPath} from '../../../ProjectPath';
import {PhotoProcessing} from '../../fileprocessing/PhotoProcessing';
import {VideoProcessing} from '../../fileprocessing/VideoProcessing';
import * as rimraf from 'rimraf';

const LOG_TAG = '[TempFolderCleaningJob]';

const rimrafPR = util.promisify(rimraf);


export class TempFolderCleaningJob extends Job {
  public readonly Name = DefaultsJobs[DefaultsJobs['Temp Folder Cleaning']];
  public readonly ConfigTemplate: ConfigTemplateEntry[] = null;
  public readonly Supported = true;
  directoryQueue: string[] = [];
  private tempRootCleaned = false;


  protected async init() {
    this.tempRootCleaned = false;
    this.directoryQueue = [];
    this.directoryQueue.push(ProjectPath.TranscodedFolder);
  }


  protected async isValidFile(filePath: string): Promise<boolean> {
    if (PhotoProcessing.isPhoto(filePath)) {
      return PhotoProcessing.isValidConvertedPath(filePath);
    }

    if (VideoProcessing.isVideo(filePath)) {
      return VideoProcessing.isValidConvertedPath(filePath);
    }

    return false;
  }

  protected async isValidDirectory(filePath: string): Promise<boolean> {
    const originalPath = path.join(ProjectPath.ImageFolder,
      path.relative(ProjectPath.TranscodedFolder, filePath));
    try {
      await fsp.access(originalPath);
      return true;
    } catch (e) {
    }
    return false;
  }

  protected async readDir(dirPath: string): Promise<string[]> {
    return (await fsp.readdir(dirPath)).map(f => path.normalize(path.join(dirPath, f)));
  }

  protected async stepTempDirectory() {
    const files = await this.readDir(ProjectPath.TempFolder);
    const validFiles = [ProjectPath.TranscodedFolder, ProjectPath.FacesFolder];
    for (let i = 0; i < files.length; ++i) {
      if (validFiles.indexOf(files[i]) === -1) {
        if ((await fsp.stat(files[i])).isDirectory()) {
          await rimrafPR(files[i]);
        } else {
          await fsp.unlink(files[i]);
        }
      }
    }

    this.progress.time.current = Date.now();

    this.progress.comment = 'processing: ' + ProjectPath.TempFolder;

    return this.progress;


  }

  protected async stepConvertedDirectory() {


    this.progress.time.current = Date.now();


    const filePath = this.directoryQueue.shift();
    const stat = await fsp.stat(filePath);

    this.progress.left = this.directoryQueue.length;
    this.progress.progress++;
    this.progress.comment = 'processing: ' + filePath;
    if (stat.isDirectory()) {
      if (await this.isValidDirectory(filePath) === false) {
        await rimrafPR(filePath);
      } else {
        this.directoryQueue = this.directoryQueue.concat(await this.readDir(filePath));
      }
    } else {
      if (await this.isValidFile(filePath) === false) {
        await fsp.unlink(filePath);
      }
    }
    return this.progress;
  }

  protected async step(): Promise<JobProgressDTO> {
    if (this.directoryQueue.length === 0) {
      return null;
    }
    if (this.tempRootCleaned === false) {
      this.tempRootCleaned = true;
      return this.stepTempDirectory();
    }
    return this.stepConvertedDirectory();
  }

}
