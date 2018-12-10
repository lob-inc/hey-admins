import * as Functions from 'firebase-functions'
import * as Express from 'express'
import { IncomingWebhook, IncomingWebhookSendArguments, MessageAttachment } from '@slack/client'

interface RequestError {
  status: number
  message: string
}

interface ResponseBody {
  response_type: 'in_channel' | 'ephemeral'
  text: string
  attachmennts?: MessageAttachment
}

interface SlackConfig {
  verification_token: string
  webhook_url: string
  channel: string
  username: string
  icon_url?: string
}

const slackConfig: SlackConfig = Functions.config().slack

const validateRequest = (request: Express.Request): RequestError => {
  if (request.method !== 'POST') {
    return {
      status: 405,
      message: 'Accepts only POST requests',
    }
  }
  if (!request.body || request.body.token !== slackConfig.verification_token) {
    return {
      status: 404,
      message: 'Invalid credentials',
    }
  }
  return null
}

const makeIncomingWebhookSendArguments = (request: Express.Request): IncomingWebhookSendArguments => {
  const icon = slackConfig.icon_url ? { icon_url: slackConfig.icon_url } : { icon_emoji: '#innocent' }
  return {
    ...icon,
    text: `@here ${request.body.user_name}からお便りがとどきました。`,
    username: slackConfig.username,
    channel: slackConfig.channel,
    link_names: true,
    attachments: [
      {
        color: 'good',
        text: request.body.text,
      },
    ],
  }
}

const makeResponseBody = (request: Express.Request): ResponseBody => {
  return {
    response_type: 'ephemeral',
    text: `あなたの願いが送信されました「${request.body.text}」`,
  }
}

const sendErrorResponse = (error: RequestError, response: Express.Response): Express.Response => {
  response.statusCode = error.status
  return response.send(error.message)
}

export const heyAdmins: Functions.HttpsFunction = Functions.https.onRequest(
  async (request: Express.Request, response: Express.Response): Promise<Express.Response> => {
    if (!slackConfig.webhook_url) {
      return sendErrorResponse({ status: 500, message: 'no webhook url' }, response)
    }

    const err = validateRequest(request)
    if (err) {
      return sendErrorResponse(err, response)
    }

    await new IncomingWebhook(slackConfig.webhook_url).send(makeIncomingWebhookSendArguments(request))
    return response.send(makeResponseBody(request))
  }
)
