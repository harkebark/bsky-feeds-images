import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { validateAuth } from '../auth'
import dotenv from 'dotenv'
import { AtUri } from '@atproto/uri'
import { BskyAgent } from '@atproto/api'

// This defines the "getFeedSkeleton" method which is called whenever a request is made for a feed
export default function (server: Server, ctx: AppContext, agent: BskyAgent) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    dotenv.config()

    const feedUri = new AtUri(params.feed)

    let auth : string | null = null

    // authenticate request
    try {
      auth = await validateAuth(req, `did:web:${process.env.FEEDGEN_HOSTNAME}`, ctx.didResolver)
    } catch (error) {
      console.log("Failed to authenticate")
    }

    // Choose the algorithm for the feed
    const algo = algos[feedUri.rkey].handler
    if (
      feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }

    // Run the algo, get feed body
    const body = await algo(ctx, params, agent, auth)

    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
