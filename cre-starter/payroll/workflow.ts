import { cre, type HTTPPayload, type TeeRuntime } from '@chainlink/cre-sdk'
import { z } from 'zod'
import { compilePayroll, parsePayroll } from '../../services/cre-workflow/src/compiler'

// This starter accepts only the local synthetic fixture. Remote payroll remains separate.
export const configSchema = z.object({
  simulationOnly: z.literal(true),
  chainId: z.literal('11155111'),
  poolAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
    .refine(value => BigInt(value) !== 0n).transform(value => value as `0x${string}`),
  payrollBaseUrl: z.literal('http://127.0.0.1:8791/batches'),
  payrollApiSecretId: z.literal('PAYROLL_API_TOKEN'),
}).strict()
type Config = z.infer<typeof configSchema>

const triggerSchema = z.object({
  batchId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  expectedCommitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  expectedEnvelopeRoot: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
}).strict()

export async function onHttpTrigger(runtime: TeeRuntime<Config>, payload: HTTPPayload) {
  let request: z.infer<typeof triggerSchema>
  try {
    if (payload.input.length > 2_048) throw new Error()
    request = triggerSchema.parse(JSON.parse(new TextDecoder().decode(payload.input)))
  } catch {
    throw new Error('NULL_CRE_INPUT_INVALID')
  }
  try {
    const token = runtime.getSecret({ id: runtime.config.payrollApiSecretId }).result().value
    // Regular HTTPClient + TeeRuntime is the official confidential-workflow pattern.
    // The bearer, response and compiler inputs never cross into DON calls.
    const response = new cre.capabilities.HTTPClient().sendRequest(runtime, {
      url: `${runtime.config.payrollBaseUrl}/${request.batchId}`,
      method: 'GET',
      multiHeaders: { Authorization: { values: [`Bearer ${token}`] } },
      cacheSettings: { store: false, maxAge: '0s' },
      timeout: '15s',
    }).result()
    if (response.statusCode !== 200 || response.body.length > 65_536) {
      throw new Error('NULL_CRE_FETCH_FAILED')
    }
    const payroll = parsePayroll(JSON.parse(new TextDecoder().decode(response.body)), request.batchId)
    const publicBundle = await compilePayroll(payroll, runtime.config, {
      commitment: request.expectedCommitment,
      envelopeRoot: request.expectedEnvelopeRoot,
    })
    // Fixed simulation-only log: never interpolate payroll or a credential.
    runtime.log('NULL payroll simulation: validated batch and compiled 8 encrypted envelopes.')
    return { mode: 'cre-tee-simulation', publicBundle }
  } catch (error) {
    if (error instanceof Error && error.message === 'NULL_CRE_COMPILE_MISMATCH') throw error
    throw new Error('NULL_CRE_COMPILE_FAILED')
  }
}

export function initWorkflow(config: Config) {
  configSchema.parse(config)
  // The official HTTP docs permit empty authorization only for local simulation.
  return [cre.handlerInTee(new cre.capabilities.HTTPCapability().trigger({}), onHttpTrigger,
    [{ tee: 'nitro', regions: ['us-west-2'] }])]
}
