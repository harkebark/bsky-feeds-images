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

export const handler = async (ctx: AppContext, params: QueryParams, agent: BskyAgent, requesterDID?: string | null) => {

  let authors: any[] = [];
  let req_cursor: string | null = null;

  console.log("requesting follows")

  if (requesterDID) {

    try {
      

      while (true) {

        const res = await agent.api.app.bsky.graph.getFollows({
          actor: requesterDID,
          ... (req_cursor !== null ? {['cursor']: req_cursor} : {})
        })
        console.log("res:", res)

        const follows = res.data.follows.map((profile) => {
          return profile.did
        })
        console.log("Follows:", follows)
        authors.push(...follows)
        console.log("authors:", authors)
        if(res.data.cursor) {
          req_cursor = res.data.cursor
        } else {
          break
        }
        console.log("cursor:", req_cursor)
      }
  
      
    } catch (error) {
      console.log("ERROR:::", error)
    }
    
  } 

  console.log("querying posts...")
  const builder = await dbClient.getLatestPostsForTag(
    shortname,
    params.limit,
    params.cursor,
    false, // Images
    true, 
    false, 
    authors
  )
  console.log("posts queried, building feed")
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

      console.log(
        `${this.name}: ${post.uri.split('/').at(-1)} has an image}`,
      )
    }

    return return_value
  }
}
