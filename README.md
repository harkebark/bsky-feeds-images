# Harke's Image Feeds

This code is a fork of https://github.com/Bossett/bsky-feeds by Bossett, which was originally a fork of [the official Bluesky feed generator starter kit](https://github.com/bluesky-social/feed-generator). Both repos contain lots of information about the mechanics of feed generation and how to publish feeds.

The feeds in this repo store all image posts off the firehose to a database and use authentication to provide user-specific feeds. This allows for users to only see posts from people they are following in the feed without manually setting up a feed.

# Hosting

This feed is hosted on [Digital Ocean](https://m.do.co/c/a838c8f1e33a) which was achieved by [following the guide written by Bossett.](https://bossett.io/setting-up-bossetts-bluesky-feed-generator/) It walks you through setup of the app and gives Bossett some affiliate credit for putting all of this together. Given the high volume of image posts I recommend using the $10 application tier instead of the $5 testing tier recommended in the guide, but ymmv.

# Feeds

## After Dark Feed

Currently the only feed, watches for any NSFW images and serves the user any images created by people they follow.

Feed at https://bsky.app/profile/did:plc:bfuck3vwwacatltdmnilloym/feed/mutuals-ad

# Usage

I run this with Digital Ocean App Platform, with their MongoDB as an attached service. Instructions for setting this up can be found in the above guide.

## Database

The DB could feasibly be swapped out for any other, and there are lots of changes that could make it more efficient. However, if you're new I recommend using the provided dbClient.

## Docker

I am deploying with Docker rather than the default Node containers. This was more important early on for control over the exact Node version, as certain dependencies were linked tightly to Node 18.

## Adding Feeds

The tool is built to have each algorithm self-contained within a file in [src/algos](src/algos). Each algorithm should export both a handler function and manager class (that can inherit from algoManager). The _manager_ is expected to implement filter methods (e.g. filter_post) that will match events that the algorithm will later deal with.

Where there's a match, the post will be stored in the database, tagged for the algorithm that matched. This can be used later in the handler function to identify posts that the algorithm should return.

Feeds will have periodicTask called every X minutes from the environment setting in FEEDGEN_TASK_INTEVAL_MINS - this is for things like list updates, or time consuming tasks that shouldn't happen interactively.

Labels are fetched periodically via the batchUpdate function.

## Major TODOs

- TODO: Add filtering for manual tagging in alt text
- TODO: Add feed for "Home+" which shows posts from "friends of friends"
- TODO: Add feed pinning

