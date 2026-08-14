const fs = require("fs");
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
  const fnName = process.env.FC_FUNCTION;
  const zipPath = process.env.FC_ZIP;
  const accountId = await getAccountId();
  const config = new OpenApi.Config({ accessKeyId: process.env.ALI_AK_ID, accessKeySecret: process.env.ALI_AK_SECRET });
  config.endpoint = accountId + ".cn-shenzhen.fc.aliyuncs.com";
  config.readTimeout = 300000;
  config.connectTimeout = 60000;
  const client = new FCClient(config);
  const rt = new Util.RuntimeOptions({});

  const cur = await client.getFunctionWithOptions(fnName, new FC.GetFunctionRequest({}), {}, rt);
  console.log("runtime=" + cur.body.runtime + " handler=" + cur.body.handler);
  console.log("crc=" + JSON.stringify(cur.body.customRuntimeConfig || {}));

  const zipB64 = fs.readFileSync(zipPath).toString("base64");
  const input = new FC.UpdateFunctionInput({ code: new FC.InputCodeLocation({ zipFile: zipB64 }) });
  const resp = await client.updateFunctionWithOptions(fnName, new FC.UpdateFunctionRequest({ body: input }), {}, rt);
  console.log("UPDATE_OK codeSize=" + resp.body.codeSize);
}

main().catch(function (e) {
  console.error("ERR:", e && (e.message || e));
  if (e && e.data) console.error("DATA:", JSON.stringify(e.data));
  process.exit(1);
});
