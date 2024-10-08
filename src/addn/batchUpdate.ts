import dbClient from '../db/dbClient'

// Labels are automatically assigned to posts ~30 seconds after a post is made.
// This function runs every minute, queries all unlabeled posts, and tries to
// fetch labels for them.

// This could be made more efficient, either by deleting any unlabelled posts which 
// still don't have labels after two checks, or by removing this function altogether
// and queing incoming image posts to have their labels checked BEFORE storing
// them in the DB. 
export default async function batchUpdate(agent, interval) {
  let firstRun = true
  while (true) {
    if (!firstRun) await new Promise((resolve) => setTimeout(resolve, interval))
    else firstRun = false

    console.log('core: Updating Labels...')

    const unlabelledPosts = await dbClient.getUnlabelledPostsWithImages(
      300,
      interval,
    )

    if (unlabelledPosts.length === 0) {
      console.log("all posts have labels")
      continue
    }

    const chunkSize = 25

    const postEntries: { uri: string; labels: string[] }[] = []

    for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
      const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
        return [item.uri]
      })
      const res = await agent.app.bsky.feed.getPosts({ uris: chunk })

      const posts = res.data.posts

      if (posts.length === 0) {
        chunk.forEach((uri) => {
          postEntries.push({ uri: uri, labels: [] })
        })
      }

      for (let k = 0; k < posts.length; k++) {
        const labels: string[] = []
        if (posts[k].labels.length !== 0) {
          posts[k].labels.forEach((label) => {
            labels.push(label.val)
          })
        }
        postEntries.push({ uri: posts[k].uri, labels: labels })
      }
    }
    dbClient.updateLabelsForURIs(postEntries)
  }
}