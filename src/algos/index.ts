import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as afterdark from './after-dark'
import { BskyAgent } from '@atproto/api'

type AlgoHandler = (ctx: AppContext, params: QueryParams, agent: BskyAgent, requesterDID?: string | null) => Promise<AlgoOutput>

const algos = {
  [afterdark.shortname]: {
    handler: <AlgoHandler>afterdark.handler,
    manager: afterdark.manager,
  }
}

export default algos
