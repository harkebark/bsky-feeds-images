import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

import algos from './algos'

import { Database } from './db'

import crypto from 'crypto'
import { Post } from './db/schema'
import { BskyAgent } from '@atproto/api'
import batchUpdate from './addn/batchUpdate'

// This "firehose" facilitates the modification of the database based on repo events
// Every time there are new posts `handleEvent` gets run. This is where posts
// are filtered before being stored to the database.
export class FirehoseSubscription extends FirehoseSubscriptionBase {
  public algoManagers: any[]

  constructor(db: Database, subscriptionEndpoint: string) {
    super(db, subscriptionEndpoint)

    this.algoManagers = []

    Object.keys(algos).forEach((algo) => {
      this.algoManagers.push(new algos[algo].manager(db))
    })

    this.algoManagers.forEach(async (algo) => {
      await algo._start()
    })
  }

  public authorList: string[]
  public intervalId: NodeJS.Timer

  // Handle a change to the feed repo/database
  async handleEvent(evt: RepoEvent) {
    for (let i = 0; i < this.algoManagers.length; i++) {
      await this.algoManagers[i].ready()
    }

    dotenv.config()
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    // Any posts that should be deleted from the databases because a user deleted them
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)

    // List of words to search for in text for inclusion
    const keywords = ["#nsfw"]

    // Any posts that have been made since the last change
    const postsCreated: Post[] = ops.posts.creates.flatMap((create) => {

      const text = create.record?.text?.toLowerCase()
      let label: string[] | null = null

      // Checks for keywords, assigns nudity label if found
      if (text) {
        for (let word of keywords) {
          if (text.includes(word.toLowerCase())) {
            label = ['nudity']
            break
          }
        }
      }

      // Create Post object for DB
      const post: Post = {
        _id: null,
        uri: create.uri,
        cid: create.cid,
        author: create.author,
        text: create.record?.text,
        replyParent: create.record?.reply?.parent.uri ?? null,
        replyRoot: create.record?.reply?.root.uri ?? null,
        indexedAt: new Date().getTime(),
        hasImage: !!(create?.record?.embed?.images || create?.record?.embed?.media),
        algoTags: null,
        embed: create.record?.embed,
        labels: label
      }

      return [post]

    })

    const postsToCreate: Post[] = []

    // Check all new posts to see if they should be included in feed database
    for (let post_i = 0; post_i < postsCreated.length; post_i++) {
      const post = postsCreated[post_i]
      const algoTags: string[] = []
      let include = false

      // For each algorithm, check if the post meets algorithm requirements
      for (let i = 0; i < this.algoManagers.length; i++) {
        const includeAlgo = await this.algoManagers[i].filter_post(post)
        include = include || includeAlgo
        if (includeAlgo) algoTags.push(`${this.algoManagers[i].name}`)
      }

      if (!include) return

      const hash = crypto
        .createHash('shake256', { outputLength: 12 })
        .update(post.uri)
        .digest('hex')
        .toString()

      post._id = hash
      post.algoTags = [...algoTags]

      // After determining post eligibility, add it to list of posts to add to DB
      postsToCreate.push(post)
    }

    // Actually delete the posts
    if (postsToDelete.length > 0) {
      await this.db.deleteManyURI('post', postsToDelete)
    }

    // Actually add the new posts
    if (postsToCreate.length > 0) {
      // postsToCreate.forEach(async (to_insert) => {
      //   await this.db.replaceOneURI('post', to_insert.uri, to_insert)
      // })
      await this.db.replaceManyURI('post', postsToCreate);
    }
  }
}
