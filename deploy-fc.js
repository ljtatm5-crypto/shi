// 部署：查账号ID → 运行时改nodejs20 + customRuntimeConfig(node server.js:9000) + 代码 + 环境变量
const fs = require("fs");
const FC = require("@alicloud/fc20230330");
const OpenApi = require("@alicloud/openapi-client");
const Util = require("@alicloud/tea-util");
const STS = require("@alicloud/sts20150401");

const FCClient = FC.default;
const STSClient = STS.default;

async function getAccountId() {
  const cfg = new OpenApi.Config({
    accessKeyId: process.env.ALI_AK_ID,
    accessKeySecret: process.env.ALI_AK_SECRET,
  });
  cfg.endpoint = "sts.cn-shenzhen.aliyuncs.com";
  return (await new STSClient(cfg).getCallerIdentityWithOptions(new Util.RuntimeOptions({}))).body.accountId;
}

async function main() {
  const region = process.env.FC_REGION || "cn-shenzhen";
  const fnName = process.env.FC_FUNCTION || "shi";
  const accountId = await getAccountId();
  console.log("accountId=" + accountId);

  const config = new OpenApi.Config({
    accessKeyId: process.env.ALI_AK_ID,
    accessKeySecret: process.env.ALI_AK_SECRET,
  });
  config.endpoint = `${accountId}.${region}.fc.aliyuncs.com`;
  config.readTimeout = 180000;
  config.connectTimeout = 60000;
  const client = new FCClient(config);

  const zipB64 = fs.readFileSync(process.env.FC_ZIP).toString("base64");

  const input = new FC.UpdateFunctionInput({
    runtime: "nodejs20",
    customRuntimeConfig: new FC.CustomRuntimeConfig({
      command: ["node"],
      args: ["server.js"],
      port: 9000,
    }),
    code: new FC.InputCodeLocation({ zipFile: zipB64 }),
    environmentVariables: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    },
  });
  const req = new FC.UpdateFunctionRequest({ body: input });
  const resp = await client.updateFunctionWithOptions(fnName, req, {}, new Util.RuntimeOptions({}));
  const b = resp.body || {};
  console.log("UPDATE_OK runtime=" + b.runtime + " codeSize=" + b.codeSize);
  console.log("crc=" + JSON.stringify(b.customRuntimeConfig || {}));
}

main().catch((e) => {
  console.error("DEPLOY_ERR:", e && (e.message || e));
  if (e && e.data) console.error("DATA:", JSON.stringify(e.data));
  process.exit(1);
});
