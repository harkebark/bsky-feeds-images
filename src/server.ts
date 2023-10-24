import http from 'http'
import events from 'events'
import express from 'express'
import dotenv from 'dotenv'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import dbClient, { dbSingleton } from './db/dbClient'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { BskyAgent, RichTextSegment } from '@atproto/api'
import batchUpdate from './addn/batchUpdate'

// Feed Generator Server code, pretty much everything is created here
export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public firehose: FirehoseSubscription
  public cfg: Config
  public db: dbSingleton | null
  public agent: BskyAgent

  constructor(
    app: express.Application,
    firehose: FirehoseSubscription,
    cfg: Config,
    db: dbSingleton,
    agent: BskyAgent
  ) {
    this.app = app
    this.firehose = firehose
    this.cfg = cfg
    this.db = db
    this.agent = agent
  }

  // Init function, sets up express server, database client, firehose subscription, and logs into bsky agent
  static async create(cfg: Config) {
    const app = express()
    const db = dbClient


    const agent = new BskyAgent({service: 'https://bsky.social'})
    dotenv.config()
    const handle = `${process.env.FEEDGEN_HANDLE}`
    const password = `${process.env.FEEDGEN_PASSWORD}`

    // Sets up event to update database with new labels every minute
    // This could absolutely be made more efficient using either 
    // label subscriptions or by queing posts and waiting for labels
    // before saving to database
    await agent.login({identifier: handle, password: password}).then(() => {
      batchUpdate(agent, 3 * 60 * 1000)
    })

    const firehose = new FirehoseSubscription(db, cfg.subscriptionEndpoint)


    const didCache = new MemoryCache()
    const didResolver = new DidResolver(
      { plcUrl: 'https://plc.directory',
      didCache }
    )

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }

    
    db.deleteSqueakyCleanPosts()
    feedGeneration(server, ctx, agent) // the actual method that runs upon a feed request
    describeGenerator(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))

    return new FeedGenerator(app, firehose, cfg, db, agent)
  }

  async start(): Promise<http.Server> {
    // await this.db?.deleteAll('post');
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    return this.server
  }
}

export default FeedGenerator
