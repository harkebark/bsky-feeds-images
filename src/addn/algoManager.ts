import dotenv from 'dotenv'
import { Database } from '../db'
import { Post } from '../db/schema'

export class AlgoManager {
  private static _instance: AlgoManager

  public db: Database
  public periodicIntervalId: NodeJS.Timer

  public name: string = ''

  public _isReady: Boolean = false
  public _isStarting: Boolean = false

  constructor(db: Database) {
    this.db = db
    this._isReady = false
    this._isStarting = false
  }

  public async _start() {
    if (this._isStarting) return false
    else this._isStarting = true

    dotenv.config()

    let task_inverval_mins = 2
    if (
      process.env.FEEDGEN_TASK_INTEVAL_MINS !== undefined &&
      Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS) > 0
    ) {
      task_inverval_mins = Number.parseInt(
        process.env.FEEDGEN_TASK_INTEVAL_MINS,
      )
    }

    await this.periodicTask()
    if (!this.periodicIntervalId) {
      this.periodicIntervalId = setInterval(() => {
        this.periodicTask()
      }, task_inverval_mins * 60 * 1000)
    }

    await this.start()

    this._isReady = true
    return this._isReady
  }

  public async start() {
    return
  }

  public async ready(): Promise<Boolean> {
    if (this._isReady) return this._isReady
    else return await this._start()
  }

  public async periodicTask() {
    return
  }

  public async filter_post(post: Post): Promise<Boolean> {
    return false
  }
}
