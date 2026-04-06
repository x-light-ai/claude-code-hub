# 发货接口使用说明

## 概述

发货接口用于按用户名开通或更新账号，并返回可直接使用的 API Key。

- 接口路径：`POST /api/actions/delivery/provision`
- 权限要求：管理员
- 认证方式：`auth-token` Cookie 或 `Authorization: Bearer <token>`
- OpenAPI 标签：`发货接口`

该接口对应的后端实现位于 [src/actions/delivery.ts](../src/actions/delivery.ts)，HTTP 路由注册位于 [src/app/api/actions/[...route]/route.ts](../src/app/api/actions/[...route]/route.ts)。

## 接口行为

接口会根据 `username` 执行以下逻辑：

1. 如果用户不存在，则自动创建用户
2. 如果用户已存在，则复用该用户，不修改 user 级别的并发和过期时间配置
3. 根据 `regenerateKey` 决定是更新首个已有 Key 的过期策略、并发和额度，还是删除旧 Key 后重新生成新 Key
4. 过期策略支持绝对时间 `expiresAt` 或相对有效期 `durationDays` 二选一，且只作用在 Key 上
5. 可选为发货 Key 设置名称、总额度 `limitTotalUsd` 与并发上限 `limitConcurrentSessions`
6. 返回最终可使用的 API Key、用户 ID 和处理结果标记

后端实现细节：

- 用户查找：通过 `findUserByName()` 按用户名查询
- 新建用户：不存在时调用 `createUser()` 自动创建基础用户，备注默认为空
- 已有用户：存在时直接复用，不更新 user 级别配置
- 重新生成 Key：删除该用户当前所有 Key 后新建一个 Key，并写入本次请求的名称、过期策略、并发与额度配置
- 复用已有 Key：查询该用户当前 Key 列表；若列表非空，则直接更新查询结果中的第一个 Key 的名称、过期策略、并发与额度并返回该 Key；若列表为空，则新建一个 Key
- 相对有效期：通过 Key 仓储层的 `duration_days` 机制写入相对有效期配置，沿用现有页面保存逻辑

## 请求参数

请求体为 JSON：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `username` | `string` | 是 | 用户名，不能为空 |
| `keyName` | `string` | 否 | 发货 Key 名称；空字符串或未传时默认使用 `api` |
| `expiresAt` | `string` | 条件必填 | 绝对过期时间字符串；与 `durationDays` 二选一。schema 层仅校验非空，运行时按系统时区解析，非法日期会返回解析错误 |
| `durationDays` | `number` | 条件必填 | 相对有效期天数；与 `expiresAt` 二选一，必须为 1 到 3650 的整数 |
| `dailyLimitUsd` | `number` | 否 | 发货 Key 的每日额度（美元） |
| `limitTotalUsd` | `number \| null` | 否 | 发货 Key 的总额度上限（美元）；`null` 或未传表示不限制 |
| `limitConcurrentSessions` | `number` | 否 | 发货 Key 的并发 Session 上限；未传时更新已有 Key 不会改动该字段 |
| `dailyResetMode` | `"fixed" \| "rolling"` | 否 | 每日重置模式；未传时本接口按 `rolling` 处理，并写入 Key 配置 |
| `dailyResetTime` | `string` | 否 | 每日重置时间，格式必须为 `HH:mm`；仅在 `dailyResetMode="fixed"` 时写入 Key 配置 |
| `regenerateKey` | `boolean` | 否 | 是否强制重新生成 Key，默认 `false` |

参数校验定义见 [src/actions/delivery.ts](../src/actions/delivery.ts) 和 [src/app/api/actions/[...route]/route.ts](../src/app/api/actions/[...route]/route.ts)。

## 响应结构

成功时返回：

```json
{
  "ok": true,
  "data": {
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "userId": 123,
    "username": "alice",
    "expiresAt": "2026-12-31T15:59:59.999Z",
    "durationDays": null,
    "isNewUser": true,
    "isNewKey": true
  }
}
```

响应字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `apiKey` | `string` | 最终可用的 API Key |
| `userId` | `number` | 用户 ID |
| `username` | `string` | 用户名 |
| `expiresAt` | `string \| null` | 绝对过期时间模式下返回归一化后的 ISO 时间；相对有效期模式下为 `null` |
| `durationDays` | `number \| null` | 相对有效期模式下返回天数；绝对过期时间模式下为 `null` |
| `isNewUser` | `boolean` | 本次是否新建了用户 |
| `isNewKey` | `boolean` | 本次是否新建了 Key |

错误时返回：

```json
{
  "ok": false,
  "error": "错误信息"
}
```

常见错误：

- `未认证`：缺少认证信息
- `认证无效或已过期`：Cookie 或 Bearer token 无效
- `权限不足`：当前账号不是管理员
- `需要管理员权限`：Server Action 内部再次校验失败
- `用户名不能为空`：请求参数校验失败
- `必须提供 expiresAt 或 durationDays`：两种过期策略都未提供
- `expiresAt 与 durationDays 不能同时传入`：两种过期策略同时提供
- `过期时间不能为空`：`expiresAt` 传入空字符串
- `重置时间格式必须为 HH:mm`：`dailyResetTime` 格式错误
- `总消费上限不能为负数` / `总消费上限不能超过10000000美元`：`limitTotalUsd` 校验失败
- `Invalid date input: <输入值>`：`expiresAt` 不是可解析的日期字符串
- `发货失败`：未识别的内部异常

统一路由认证与错误处理逻辑见 [src/lib/api/action-adapter-openapi.ts](../src/lib/api/action-adapter-openapi.ts)。

## 调用示例

### curl（绝对过期时间）

```bash
curl -X POST 'http://localhost:23000/api/actions/delivery/provision' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-admin-token' \
  -d '{
    "username": "alice",
    "keyName": "api",
    "expiresAt": "2026-12-31 23:59:59",
    "dailyLimitUsd": 20,
    "limitTotalUsd": 100,
    "limitConcurrentSessions": 2,
    "dailyResetMode": "fixed",
    "dailyResetTime": "09:00",
    "regenerateKey": true
  }'
```

### curl（相对有效期）

```bash
curl -X POST 'http://localhost:23000/api/actions/delivery/provision' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-admin-token' \
  -d '{
    "username": "alice",
    "keyName": "api",
    "durationDays": 30,
    "dailyLimitUsd": 20,
    "limitTotalUsd": 100,
    "limitConcurrentSessions": 2,
    "regenerateKey": true
  }'
```

### JavaScript

```javascript
const response = await fetch('/api/actions/delivery/provision', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer your-admin-token',
  },
  body: JSON.stringify({
    username: 'alice',
    keyName: 'api',
    expiresAt: '2026-12-31 23:59:59',
    dailyLimitUsd: 20,
    limitTotalUsd: 100,
    limitConcurrentSessions: 2,
    dailyResetMode: 'fixed',
    dailyResetTime: '09:00',
    regenerateKey: true,
  }),
});

const result = await response.json();
```

## 参数语义说明

### `keyName`

- 表示本次发货生成或更新的 Key 名称
- 空字符串、仅空白字符或未传时，后端会自动使用默认值 `api`
- 该字段只作用在本次处理的 Key 上，不影响用户本身信息

### `expiresAt`

接口内部会调用 `parseDateInputAsTimezone()` 按系统时区解析输入值。

实际语义如下：

- schema 层只校验 `expiresAt` 为非空字符串，不校验是否为合法日期
- 当传入 `YYYY-MM-DD` 时，会按系统时区解释为当天 `23:59:59`
- 当传入带时区的时间字符串（如 `2026-12-31T23:59:59Z` 或带偏移量）时，按该绝对时间直接解析
- 当传入不带时区的日期时间字符串时，会按系统时区的本地时间解析
- 返回值统一为 ISO 8601 字符串
- 如果部署环境时区不同，且传入值本身不带时区，解析结果会随系统时区变化
- 如果值不可解析，会直接返回底层错误信息，例如 `Invalid date input: <输入值>`
- 与 `durationDays` 互斥，不能同时传入

### `durationDays`

- 表示相对有效期天数，必须为 1 到 3650 的整数
- 与 `expiresAt` 二选一，不能同时传入
- 接口会沿用现有 Key 页面保存逻辑，通过 Key 的 `duration_days` 机制持久化相对有效期
- 绝对过期时间模式会清空 Key 的相对有效期；相对有效期模式会清空 Key 的绝对过期时间

### `limitConcurrentSessions`

- 表示发货 Key 的并发 Session 上限
- 该字段只写入发货生成/更新的 Key，不会写入用户并发配置
- 未传时，更新已有 Key 会保留原值；新建 Key 则保持未设置状态

### `limitTotalUsd`

- 表示发货 Key 的总消费上限（美元）
- `null` 或未传表示不限制
- 该字段只写入发货生成/更新的 Key，不会写入用户的总额度配置
- 实际拦截由现有总额度限流链负责，在运行时按 Key 维度生效

### `regenerateKey`

- `false`：
  - 查询该用户当前 Key 列表
  - 如果列表非空，则直接返回查询结果中的第一个 Key
  - 如果列表为空，则自动新建一个 Key
- `true`：
  - 删除该用户当前所有 Key
  - 重新生成一个新的 Key 返回

注意：开启 `regenerateKey=true` 会使该用户旧 Key 全部失效，适合重置发货凭证场景。

### 可选字段未传时的更新行为

当用户已存在时，接口会复用该用户，并更新或重建一个 Key 的过期策略、并发与额度。

该更新逻辑只会写入本次请求中显式传入的字段，因此：

- `keyName` 未传或传空：写入默认值 `api`
- `dailyLimitUsd` 未传：保留 Key 原有值
- `limitTotalUsd` 未传：保留 Key 原有值
- `limitConcurrentSessions` 未传：保留 Key 原有值
- `dailyResetTime` 未传：在更新已有 Key 时会清空该字段，除非本次请求显式传入且 `dailyResetMode="fixed"`
- `expiresAt` 与 `durationDays` 必须二选一，不存在“两者都不传则保留”的情况

需要特别注意：

- `dailyResetMode` 即使未传，本接口也会先补默认值 `rolling`，然后写入 Key 配置
- 也就是说，更新已有 Key 时如果不传 `dailyResetMode`，不会保留原值，而是会被改成 `rolling`
- 当 `dailyResetMode` 不是 `fixed` 时，`dailyResetTime` 不会写入 Key
- `regenerateKey=false` 且用户已有 Key 时，接口会更新查询结果中的第一个 Key 的过期策略、并发与额度，而不是仅返回不改动

## 使用建议

1. 发货脚本调用前确保使用管理员身份认证
2. 若需要设置固定到期时间，传 `expiresAt`
3. 若需要按页面现有逻辑设置相对有效期，传 `durationDays`
4. `regenerateKey=false` 时会直接更新首个已有 Key 的名称、过期策略、并发与额度；若要强制重置凭证，再使用 `regenerateKey=true`
5. 若需要自定义发货 Key 名称，可传 `keyName`；不传或传空则默认使用 `api`
6. 若需要限制单个发货 Key 的累计消费，可传 `limitTotalUsd`
7. 若需要限制单个发货 Key 的并发 Session，可传 `limitConcurrentSessions`
8. 为避免时区歧义，使用 `expiresAt` 时建议在接入侧固定时间格式并验证返回值

## 相关文档

- [API 认证使用指南](./api-authentication-guide.md)
- [API 文档修复总结](./api-docs-summary.md)
- [README](../README.md)
