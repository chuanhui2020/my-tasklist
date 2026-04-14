import { Container } from '@cloudflare/containers'

export class CodeReviewContainer extends Container {
  defaultPort = 4000
  sleepAfter = '5m'

  override onStart() {
    console.log('CodeReviewContainer started')
  }

  override onStop() {
    console.log('CodeReviewContainer stopped')
  }

  override onError(error: unknown) {
    console.error('CodeReviewContainer error:', error)
  }
}
