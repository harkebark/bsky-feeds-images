import { BskyAgent } from '@atproto/api'


export const getPostLabels = async (post: string, agent: BskyAgent) => {
  let post_id = post

  const res: any = await agent.app.bsky.feed.getPostThread({
    uri: post_id
  })

  const post_labels = res.data

  return post_labels
}

export default getPostLabels
