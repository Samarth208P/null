import { Runner } from '@chainlink/cre-sdk'
import { base64 } from '@scure/base'

export async function main() {
	// poseidon-lite decodes canonical base64 constants during module loading.
	// The template SDK's browser bundle leaves atob undefined in Javy/QuickJS.
	// Install a pure-JS decoder before loading the domain compiler; no Node APIs.
	if (typeof globalThis.atob !== 'function') {
		globalThis.atob = value => Array.from(base64.decode(value), byte => String.fromCharCode(byte)).join('')
	}
	const { configSchema, initWorkflow } = await import('./workflow')
	const runner = await Runner.newRunner({ configSchema })
	await runner.run(initWorkflow)
}

main()
