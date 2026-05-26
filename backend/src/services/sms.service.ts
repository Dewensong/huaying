// @ts-ignore
import Dysmsapi, { SendSmsVerifyCodeRequest, CheckSmsVerifyCodeRequest } from '@alicloud/dypnsapi20170525'
import 'dotenv/config'

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID!
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET!
const signName = process.env.ALIYUN_SMS_SIGN_NAME || '速通互联验证码'
const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || '100001'

// @ts-ignore
const Client = Dysmsapi.default || Dysmsapi

function createClient() {
  // @ts-ignore
  return new Client({
    accessKeyId,
    accessKeySecret,
  })
}

interface SendResult {
  success: boolean
  message: string
}

/**
 * 发送短信验证码
 */
export async function sendVerificationCode(phoneNumber: string, code: string): Promise<SendResult> {
  try {
    const client = createClient()
    // 模板变量格式：code 验证码、min 有效期分钟数
    const templateParam = JSON.stringify({ code: '##code##', min: '5' })
    console.log('TemplateParam:', templateParam)

    const request = new SendSmsVerifyCodeRequest({
      phoneNumber,
      signName,
      templateCode,
      templateParam,
    })

    // @ts-ignore
    const result = await client.sendSmsVerifyCode(request)

    console.log('短信发送结果:', JSON.stringify(result?.body))

    if (result?.body?.code === 'OK') {
      return { success: true, message: '验证码已发送' }
    } else {
      return { success: false, message: result?.body?.message || '发送失败' }
    }
  } catch (error: any) {
    console.error('发送短信失败:', error)
    return { success: false, message: '发送短信失败' }
  }
}

/**
 * 校验短信验证码
 */
export async function checkVerificationCode(phoneNumber: string, code: string): Promise<SendResult> {
  try {
    const client = createClient()
    const request = new CheckSmsVerifyCodeRequest({
      phoneNumber,
      verifyCode: code,
    })

    // @ts-ignore
    const result = await client.checkSmsVerifyCode(request)

    console.log('验证码校验结果:', JSON.stringify(result?.body))

    if (result?.body?.code === 'OK') {
      return { success: true, message: '校验通过' }
    } else {
      return { success: false, message: result?.body?.message || '验证码错误' }
    }
  } catch (error: any) {
    console.error('校验验证码失败:', error)
    return { success: false, message: '校验失败' }
  }
}
