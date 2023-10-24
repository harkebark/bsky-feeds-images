import { ConnectionPoolReadyEvent, MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { InvalidRequestError } from '@atproto/xrpc-server'

dotenv.config()

export class dbSingleton {
  client: MongoClient | null = null

  constructor(connection_string: string) {
    this.client = new MongoClient(connection_string)
    this.init()
  }

  async init() {
    if (this.client === null) throw new Error('DB Cannot be null')
    await this.client.connect()

    const postCollection = this.client.db().collection('post')

    await postCollection.createIndex({ uri: 1 });
    await postCollection.createIndex({ indexedAt: -1, cid: -1 });
    // await postCollection.createIndex({ algoTags: 1 });
    await postCollection.createIndex({ author: 1 });
    await postCollection.createIndex({ labels: 1 });
    await postCollection.createIndex({ "embed.images": 1 });
    await postCollection.createIndex({ "embed.media": 1 });
  }

  // clears database
  async deleteAll(collection: string) {
    await this.client
      ?.db()
      .collection(collection)
      .deleteMany()
  }

  async deleteManyURI(collection: string, uris: string[]) {
    await this.client
      ?.db()
      .collection(collection)
      .deleteMany({ uri: { $in: uris } })
  }

  async deleteManyDID(collection: string, dids: string[]) {
    await this.client
      ?.db()
      .collection(collection)
      .deleteMany({ did: { $in: dids } })
  }

  async replaceOneURI(collection: string, uri: string, data: any) {
    if (!(typeof data._id === typeof '')) data._id = new ObjectId()
    else {
      data._id = new ObjectId(data._id)
    }

    await this.client
      ?.db()
      .collection(collection)
      .replaceOne({ uri: uri }, data, { upsert: true })
  }

  async replaceManyURI(collection: string, data: any[]) {
    const bulkOps = data.map(to_insert => ({
      replaceOne: {
        filter: { uri: to_insert.uri },
        replacement: to_insert,
        upsert: true
      }
    }));

    await this.client
      ?.db()
      .collection(collection)
      .bulkWrite(bulkOps)
  }

  async replaceOneDID(collection: string, did: string, data: any) {
    if (!(typeof data._id === typeof '')) data._id = new ObjectId()
    else {
      data._id = new ObjectId(data._id)
    }

    await this.client
      ?.db()
      .collection(collection)
      .replaceOne({ did: did }, data, { upsert: true })
  }

  async updateSubStateCursor(service: string, cursor: number) {
    await this.client
      ?.db()
      .collection('sub_state')
      .findOneAndReplace(
        { service: service },
        { service: service, cursor: cursor },
      )
  }

  async getSubStateCursor(service: string) {
    return await this.client
      ?.db()
      .collection('sub_state')
      .findOne({ service: service })
  }

  // gets latest post for a given algoTag. 
  // imagesOnly will return only images (no dual embeds)
  // if a value is provided for authors only posts made by author DIDs in the list will be retrieved
  async getLatestPostsForTag(
    tag: string,
    limit = 50,
    cursor: string | undefined = undefined,
    imagesOnly: Boolean = false,
    nsfwOnly: Boolean = false,
    excludeNSFW: Boolean = false,
    authors: string[] = [],
  ) {
    let query: { algoTags?: any; indexedAt?: any; cid?: any; author?: any } = {

    }

    // if (imagesOnly) {
    //   query['embed.images'] = { $ne: null }
    // }
    if (nsfwOnly) {
      query['labels'] = {
        $in: ['porn', 'nudity', 'sexual', 'underwear'],
        $ne: null,
      }
    }

    if (excludeNSFW) {
      query['labels'] = {
        $nin: ['porn', 'nudity', 'sexual', 'underwear'],
        // $ne: null,
      }

      // const twoMinutesAgo = new Date().getTime() - 120000;
      // if (query['indexedAt']) {
      //   query['indexedAt']['$lte'] = twoMinutesAgo;
      // } else {
      //   query['indexedAt'] = {$lte: twoMinutesAgo}
      // }
    }

    if (authors.length > 0) {
      query['author'] = {
        $in: authors
      }
    }

    if (cursor !== undefined) {
      const [indexedAt, cid] = cursor.split('::')
      if (!indexedAt || !cid) {
        throw new InvalidRequestError('malformed cursor')
      }
      const timeStr = new Date(parseInt(indexedAt, 10)).getTime()

      query['indexedAt'] = { $lte: timeStr }
      query['cid'] = { $ne: cid }
    }

    const results = this.client
      ?.db()
      .collection('post')
      .find(query)
      .sort({ indexedAt: -1, cid: -1 })
      .limit(limit)
      .toArray()
    if (results === undefined) return []
    else return results
  }


  async getTaggedPostsBetween(tag: string, start: number, end: number) {
    const larger = start > end ? start : end
    const smaller = start > end ? end : start

    const results = this.client
      ?.db()
      .collection('post')
      .find({ indexedAt: { $lt: larger, $gt: smaller }, algoTags: tag })
      .sort({ indexedAt: -1, cid: -1 })
      .toArray()

    if (results === undefined) return []
    else return results
  }

  async getDistinctFromCollection(collection: string, field: string) {
    const results = await this.client
      ?.db()
      .collection(collection)
      .distinct(field)
    if (results === undefined) return []
    else return results
  }

  async removeTagFromPostsForAuthor(tag: string, authors: string[]) {
    const pullQuery: Record<string, any> = { algoTags: { $in: [tag] } }
    await this.client
      ?.db()
      .collection('post')
      .updateMany({ author: { $in: authors } }, { $pull: pullQuery })

    await this.deleteUntaggedPosts()
  }

  async removeTagFromOldPosts(tag: string, indexedAt: number) {
    const pullQuery: Record<string, any> = { algoTags: { $in: [tag] } }
    await this.client
      ?.db()
      .collection('post')
      .updateMany({ indexedAt: { $lt: indexedAt } }, { $pull: pullQuery })

    await this.deleteUntaggedPosts()
  }

  async getUnlabelledPostsWithImages(limit = 100, lagTime = 60 * 1000) {
    const results = this.client
      ?.db()
      .collection('post')
      .find({
        $or: [
          { 'embed.images': { $ne: null } },
          { 'embed.media': { $ne: null } }
        ],
        labels: null,
        indexedAt: { $lt: new Date().getTime() - lagTime },
      })
      .sort({ indexedAt: -1, cid: -1 })
      .limit(limit)
      .toArray()

    return results || []
  }

  async updateLabelsForURIs(postEntries: { uri: string; labels: string[] }[]) {
    for (let i = 0; i < postEntries.length; i++) {
      this.client
        ?.db()
        .collection('post')
        .findOneAndUpdate(
          { uri: { $eq: postEntries[i].uri } },
          { $set: { labels: postEntries[i].labels } },
        )
    }
  }

  async deleteUntaggedPosts() {
    await this.client
      ?.db()
      .collection('post')
      .deleteMany({ algoTags: { $size: 0 } })
  }
  //new
  async deleteSqueakyCleanPosts() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
    await this.client
      ?.db()
      .collection('post')
      .deleteMany({
        $and: [
          { algoTags: { $in: ["squeaky-clean"] } },
          { algoTags: { $nin: ["mutuals-ad"] } },
          { createdAt: { $lt: fiveMinutesAgo } }
        ]
      });
  }

  async getPostForURI(uri: string) {
    const results = await this.client
      ?.db()
      .collection('post')
      .findOne({ uri: uri })
    if (results === undefined) return null
    return results
  }

}

const dbClient = new dbSingleton(
  `${process.env.FEEDGEN_MONGODB_CONNECTION_STRING}`,
)

export default dbClient
