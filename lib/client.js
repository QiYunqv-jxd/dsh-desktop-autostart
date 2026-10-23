window.__ModuleLoader__.load({
  id: 'dsh-desktop-autostart',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var API = '/dsh-desktop-autostart'

    var CSS = [
      '.__da_root{max-width:620px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__da_card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}',
      '.__da_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__da_title{font-size:13px;font-weight:600}',
      '.__da_hint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
      '.__da_path{font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-tertiary);word-break:break-all}',
      '.__da_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__da_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__da_btn:disabled{opacity:.5;cursor:default}',
      '.__da_on{border-color:var(--dsw-alias-state-business-primary,#3964fe)}',
      '.__da_state{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.__da_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__da_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}'
    ].join('')
    var styleId = 'dsh-desktop-autostart/settings.css'

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById(styleId)) return
      var tag = document.createElement('style')
      tag.id = styleId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function Panel() {
      ensureStyle()
      var store = react.useState({ phase: 'loading', data: null, error: '', notice: '' })
      var view = store[0]
      var setView = store[1]
      var busyStore = react.useState(false)
      var busy = busyStore[0]
      var setBusy = busyStore[1]

      var load = function () {
        setView(function (prev) { return { phase: 'loading', data: prev.data, error: '', notice: prev.notice } })
        fetch(API + '/state', { headers: { Accept: 'application/json' } })
          .then(function (res) { return res.json() })
          .then(function (json) {
            if (!json || json.ok !== true) throw new Error((json && json.error) || '读取状态失败')
            setView({ phase: 'ready', data: json, error: '', notice: '' })
          })
          .catch(function (error) {
            setView(function (prev) { return { phase: 'ready', data: prev.data, error: String(error && error.message ? error.message : error), notice: '' } })
          })
      }

      react.useEffect(function () { load() }, [])

      var toggle = function () {
        if (!view.data || busy) return
        var wanted = !view.data.enabled
        setBusy(true)
        setView(function (prev) { return { phase: prev.phase, data: prev.data, error: '', notice: '' } })
        fetch(API + '/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ enabled: wanted })
        })
          .then(function (res) { return res.json() })
          .then(function (json) {
            if (!json || json.ok !== true) throw new Error((json && json.error) || '操作失败')
            setView({ phase: 'ready', data: json, error: '', notice: wanted ? '已开启，下次登录 Windows 会自动启动' : '已关闭，下次登录不会再自动启动' })
          })
          .catch(function (error) {
            setView(function (prev) { return { phase: 'ready', data: prev.data, error: String(error && error.message ? error.message : error), notice: '' } })
          })
          .then(function () { setBusy(false) })
      }

      var data = view.data || {}
      var enabled = data.enabled === true
      var mismatch = enabled && data.matches === false
      var stateText = view.phase === 'loading' && !view.data ? '读取中…' : enabled ? '已开启' : '未开启'

      return h('div', { className: '__da_root' },
        h('div', { className: '__da_card' },
          h('div', { className: '__da_row' },
            h('span', { className: '__da_title' }, '登录 Windows 时自动启动 DeepSeek Harness'),
            h('span', { className: '__da_state' }, stateText)
          ),
          h('div', { className: '__da_hint' },
            '只写用户启动文件夹里的一个快捷方式。不写注册表，不需要管理员，不额外常驻进程；关掉时只删除这一条。'
          ),
          h('div', { className: '__da_row' },
            h('button', {
              className: '__da_btn' + (enabled ? '' : ' __da_on'),
              disabled: busy || (!view.data && view.phase === 'loading'),
              onClick: toggle
            }, busy ? '处理中…' : enabled ? '关闭自启' : '开启自启')
          ),
          mismatch
            ? h('div', { className: '__da_err' }, '现有快捷方式指向的不是当前程序：' + (data.target || '未知') + '，点一次开启自启就会改成当前程序。')
            : null,
          data.path ? h('div', { className: '__da_path' }, '快捷方式：' + data.path) : null,
          data.target ? h('div', { className: '__da_path' }, '目标：' + data.target) : null,
          view.notice ? h('div', { className: '__da_ok' }, view.notice) : null,
          view.error ? h('div', { className: '__da_err' }, view.error) : null
        ),
        h('div', { className: '__da_hint' },
          '卸载或删除插件不会动你启动文件夹里的条目；想彻底关掉，先在这里点「关闭自启」，再卸载。'
        )
      )
    }

    var inject = ['slots']

    function apply(ctx) {
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'desktop-autostart', order: 27, label: '开机自启' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
