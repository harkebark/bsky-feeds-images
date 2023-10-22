import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getPostLabels from '../addn/getPostLabels'
import batchUpdate from '../addn/batchUpdate'

dotenv.config()

// max 15 chars
export const shortname = 'mutuals-ad'

// the handler is run every time a user requests a feed
// this handler gets a list of every user followed by the requester
// and fetches all tagged posts from the database which are made 
// by someone the user is following
export const handler = async (ctx: AppContext, params: QueryParams, agent: BskyAgent, requesterDID?: string | null) => {

  let authors: any[] = [];
  let req_cursor: string | null = null;

  if (requesterDID) {

    try {

      authors.push(requesterDID)

      // following lists are paginated, run in a loop until we've fetched all follows

      console.log("Fetching followers...")
      console.time("followFetch")

      while (true) {

        const res = await agent.api.app.bsky.graph.getFollows({
          actor: requesterDID,
          ... (req_cursor !== null ? { ['cursor']: req_cursor } : {})
        })

        const follows = res.data.follows.map((profile) => {
          return profile.did
        })
        authors.push(...follows)
        if (res.data.cursor) {
          req_cursor = res.data.cursor
        } else {
          break
        }
      }
      console.timeEnd("followFetch")

    } catch (error) {
      console.log("ERROR:::", error)
    }

  }

  console.log("querying db...")
  console.time("query")
  const builder = await dbClient.getLatestPostsForTag(
    shortname,
    params.limit,
    params.cursor,
    false, // Images
    true, // NSFW Only
    false, // Don't Exclude NSFW
    authors // List of authors to restrict query to
  )
  console.timeEnd("query")

  const feed = builder.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = builder.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}

// The manager runs `periodicTask` every 15 minutes, which removes any post older than a week. 
// `filter_post` is run by the firehose subscription method. It simply filters out posts which don't have media.
export class manager extends AlgoManager {
  public name: string = shortname
  public async periodicTask() {

    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }


  public async filter_post(post: Post): Promise<Boolean> {

    let return_value: Boolean | undefined = false

    if (post.hasImage) {
      return_value = true
    }

    return return_value
  }
}
