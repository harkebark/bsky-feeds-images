import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as forScience from './for-science'
import * as ausPol from './auspol'
import * as dads from './dads'
import * as dadsMedia from './dads-media'
import * as EighteenPlusND from './18-plus-nd'
import * as ND from './nd'
import * as discourse from './discourse'
import * as cats from './cats'
import * as elusive from './elusive'
import * as keyboards from './keyboards'
import * as webhook from './webhook'
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
