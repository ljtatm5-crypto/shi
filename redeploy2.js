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
  const region = "cn-shenzhen";
  const fnName = "shi";
  const accountId = await getAccountId();
  const config = new OpenApi.Config({ accessKeyId: process.env.ALI_AK_ID, accessKeySecret: process.env.ALI_AK_SECRET });
  config.endpoint = accountId + "." + region + ".fc.aliyuncs.com";
  config.readTimeout = 180000;
  config.connectTimeout = 60000;
  const client = new FCClient(config);
  const rt = new Util.RuntimeOptions({});
  const cmd = process.env.FC_CMD;

  const input = new FC.UpdateFunctionInput({
    customRuntimeConfig: new FC.CustomRuntimeConfig({
      command: ["bash", "-c", cmd],
      port: 9000,
    }),
    environmentVariables: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    },
  });
  const resp = await client.updateFunctionWithOptions(fnName, new FC.UpdateFunctionRequest({ body: input }), {}, rt);
  console.log("UPDATE_OK runtime=" + resp.body.runtime);
  console.log("crc=" + JSON.stringify(resp.body.customRuntimeConfig || {}));
}
main().catch((e) => { console.error("ERR:", e && (e.message || e)); if (e && e.data) console.error("DATA:", JSON.stringify(e.data)); process.exit(1); });
