const FC = require("@alicloud/fc20230330");
const OpenApi = require("@alicloud/openapi-client");
const Util = require("@alicloud/tea-util");
const STS = require("@alicloud/sts20150401");
const FCClient = FC.default;
const STSClient = STS.default;

async function getAccountId() {
  const cfg = new OpenApi.Config({ accessKeyId: process.env.ALI_AK_ID, accessKeySecret: process.env.ALI_AK_SECRET });
  cfg.endpoint = "sts.cn-shenzhen.aliyuncs.com";
  return (await new STSClient(cfg).getCallerIdentityWithOptions(new Util.RuntimeOptions({}))).body.accountId;
}

async function main() {
  const fnName = process.env.FC_FUNCTION || "shi-node20";
  const accountId = await getAccountId();
  const config = new OpenApi.Config({ accessKeyId: process.env.ALI_AK_ID, accessKeySecret: process.env.ALI_AK_SECRET });
  config.endpoint = accountId + ".cn-shenzhen.fc.aliyuncs.com";
  config.readTimeout = 180000;
  config.connectTimeout = 60000;
  const client = new FCClient(config);
  const rt = new Util.RuntimeOptions({});

  const cur = await client.getFunctionWithOptions(fnName, new FC.GetFunctionRequest({}), {}, rt);
  const oldEnv = cur.body.environmentVariables || {};
  console.log("current envKeys=" + Object.keys(oldEnv).join(","));

  const newEnv = Object.assign({}, oldEnv, {
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    DASHSCOPE_COMPATIBLE_URL: process.env.DASHSCOPE_COMPATIBLE_URL,
    DASHSCOPE_MODEL: process.env.DASHSCOPE_MODEL || "qwen3-vl-plus",
  });

  const input = new FC.UpdateFunctionInput({ environmentVariables: newEnv });
  const resp = await client.updateFunctionWithOptions(fnName, new FC.UpdateFunctionRequest({ body: input }), {}, rt);
  console.log("UPDATE_OK envKeys=" + Object.keys(resp.body.environmentVariables || {}).join(","));
}

main().catch(function (e) {
  console.error("ERR:", e && (e.message || e));
  if (e && e.data) console.error("DATA:", JSON.stringify(e.data));
  process.exit(1);
});
