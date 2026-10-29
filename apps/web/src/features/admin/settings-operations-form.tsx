import { Button, Input } from '@xuanxue/ui'
import { type FormEvent, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getOperationsSettings, saveOperationsSettings } from './settings-operations.functions.ts'
import { CheckboxField, Field, panelClass } from './ui.tsx'

export function OperationsSettingsForm() {
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof getOperationsSettings>>>()
  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [webhook, setWebhook] = useState('')
  const [clearToken, setClearToken] = useState(false)
  const [clearWebhook, setClearWebhook] = useState(false)
  const [httpsUrl, setHttpsUrl] = useState('')
  const [httpsKey, setHttpsKey] = useState('')
  const [clearHttps, setClearHttps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    void getOperationsSettings()
      .then((value) => {
        setSaved(value)
        setChatId(value.telegramChatId)
      })
      .catch(() => setMessage(m.admin_operations_settings_unavailable()))
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await saveOperationsSettings({
        data: {
          telegramChatId: chatId,
          ...(clearToken ? { telegramBotToken: null } : token ? { telegramBotToken: token } : {}),
          ...(clearWebhook
            ? { discordWebhookUrl: null }
            : webhook
              ? { discordWebhookUrl: webhook }
              : {}),
          ...(clearHttps
            ? { webhookUrl: null, webhookSecret: null }
            : {
                ...(httpsUrl ? { webhookUrl: httpsUrl } : {}),
                ...(httpsKey ? { webhookSecret: httpsKey } : {}),
              }),
        },
      })
      setToken('')
      setWebhook('')
      setClearToken(false)
      setClearWebhook(false)
      setHttpsUrl('')
      setHttpsKey('')
      setClearHttps(false)
      setSaved(await getOperationsSettings())
      setMessage(m.admin_operations_settings_saved())
    } catch {
      setMessage(m.admin_save_failed_check_channel_configuration_and_retry())
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-label={m.admin_operations_notifications()}
      className={panelClass()}
    >
      <h3 className="font-semibold text-lg">{m.admin_operations_notifications()}</h3>
      <fieldset disabled={!saved || busy} className="grid min-w-0 gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-3">
            <p className="text-sm">
              {m.admin_telegram_bot()}{' '}
              {saved?.telegramConfigured ? m.admin_configured() : m.admin_not_configured()}
            </p>
            <Field label={m.admin_telegram_bot_token()} htmlFor="telegram-token">
              <Input
                id="telegram-token"
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </Field>
            <CheckboxField
              label={m.admin_clear_telegram_token()}
              checked={clearToken}
              onChange={(event) => setClearToken(event.target.checked)}
            />
            <Field label={m.admin_telegram_chat_id()} htmlFor="telegram-chat">
              <Input
                id="telegram-chat"
                value={chatId}
                onChange={(event) => setChatId(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid content-start gap-3">
            <p className="text-sm">
              {m.admin_discord_webhook()}{' '}
              {saved?.discordConfigured ? m.admin_configured() : m.admin_not_configured()}
            </p>
            <Field label={m.admin_discord_webhook_url()} htmlFor="discord-webhook">
              <Input
                id="discord-webhook"
                type="password"
                autoComplete="new-password"
                value={webhook}
                onChange={(event) => setWebhook(event.target.value)}
              />
            </Field>
            <CheckboxField
              label={m.admin_clear_discord_webhook()}
              checked={clearWebhook}
              onChange={(event) => setClearWebhook(event.target.checked)}
            />
          </div>
          <div className="grid content-start gap-3">
            <p className="text-sm">
              {m.admin_https_webhook()}{' '}
              {saved?.webhookUrlConfigured && saved.webhookSecretConfigured
                ? m.admin_configured()
                : saved?.webhookUrlConfigured || saved?.webhookSecretConfigured
                  ? m.admin_https_webhook_needs_url_and_key()
                  : m.admin_not_configured()}
            </p>
            <Field label={m.admin_https_webhook_url()} htmlFor="https-webhook-url">
              <Input
                id="https-webhook-url"
                type="password"
                autoComplete="new-password"
                value={httpsUrl}
                onChange={(event) => setHttpsUrl(event.target.value)}
              />
            </Field>
            <Field label={m.admin_https_webhook_key()} htmlFor="https-webhook-key">
              <Input
                id="https-webhook-key"
                type="password"
                autoComplete="new-password"
                value={httpsKey}
                onChange={(event) => setHttpsKey(event.target.value)}
              />
            </Field>
            <CheckboxField
              label={m.admin_clear_https_webhook()}
              checked={clearHttps}
              onChange={(event) => setClearHttps(event.target.checked)}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {m.admin_leave_secret_inputs_empty_to_keep_configured_values()}
        </p>
        <Button type="submit" className="w-fit">
          {m.admin_save_operations_notifications()}
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  )
}
