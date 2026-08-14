// 蓝绿部署：新建（或更新）Node.js 20 运行时函数，不删除现有 custom.debian10 函数。
// 依赖环境变量：ALI_AK_ID、ALI_AK_SECRET、DEEPSEEK_API_KEY、FC_ZIP。
"use strict";

const fs = require("fs");
const FC = require("@alicloud/fc20230330");
const OpenApi = require("@alicloud/openapi-client");
const Util = require("@alicloud/tea-util");
const STS = require("@alicloud/sts20150401");

const FCClient = FC.default;
const STSClient = STS.default;

async function getAccountId() {
  const config = new OpenApi.Config({ accessKeyId: process.env.ALI_AK_ID, accessKeySecret: process.env.ALI_AK_SECRET });
  config.endpoint = "sts.cn-shenzhen.aliyuncs.com";
  return (await new STSClient(config).getCallerIdentityWithOptions(new Util.RuntimeOptions({}))).body.accountId;
}

async function main() {
  const region = process.env.FC_REGION || "cn-shenzhen";
  const functionName = process.env.FC_FUNCTION || "shi-node20";
  const zipPath = process.env.FC_ZIP;
  if (!zipPath || !fs.existsSync(zipPath)) throw new Error("FC_ZIP 未指定或文件不存在");
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("缺少 DEEPSEEK_API_KEY");

  const accountId = await getAccountId();
  const config = new OpenApi.Config({ accessKeyId: process.env.ALI_AK_ID, accessKeySecret: process.env.ALI_AK_SECRET });
  config.endpoint = `${accountId}.${region}.fc.aliyuncs.com`;
  config.readTimeout = 180000;
  config.connectTimeout = 60000;
  const client = new FCClient(config);
  const runtime = new Util.RuntimeOptions({});
  const code = new FC.InputCodeLocation({ zipFile: fs.readFileSync(zipPath).toString("base64") });
  const environmentVariables = { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-chat" };

  let exists = true;
  try { await client.getFunctionWithOptions(functionName, new FC.GetFunctionRequest({}), {}, runtime); }
  catch (error) { if (Number(error.statusCode || error.code) === 404 || /not.?found/i.test(error.message || "")) exists = false; else throw error; }

  if (!exists) {
    const body = new FC.CreateFunctionInput({
      functionName, description: "穗食拍 AI 网关（Node.js 20）", runtime: "nodejs20", handler: "index.handler",
      code, environmentVariables, cpu: 0.35, memorySize: 512, diskSize: 512, timeout: 60, internetAccess: true
    });
    await client.createFunctionWithOptions(new FC.CreateFunctionRequest({ body }), {}, runtime);
    console.log("FUNCTION_CREATED=" + functionName);
  } else {
    const body = new FC.UpdateFunctionInput({ code, environmentVariables, handler: "index.handler", timeout: 60 });
    await client.updateFunctionWithOptions(functionName, new FC.UpdateFunctionRequest({ body }), {}, runtime);
    console.log("FUNCTION_UPDATED=" + functionName);
  }

  let trigger;
  try {
    const body = new FC.CreateTriggerInput({
      triggerName: "http", triggerType: "http",
      triggerConfig: JSON.stringify({ authType: "anonymous", methods: ["GET", "POST", "OPTIONS"] })
    });
    trigger = (await client.createTriggerWithOptions(functionName, new FC.CreateTriggerRequest({ body }), {}, runtime)).body;
  } catch (error) {
    if (!/already|exist|conflict/i.test(error.message || "")) throw error;
    const listed = await client.listTriggersWithOptions(functionName, new FC.ListTriggersRequest({}), {}, runtime);
    trigger = (listed.body?.triggers || []).find((item) => item.triggerName === "http");
  }
  const url = trigger?.httpTrigger?.urlInternet;
  if (!url) throw new Error("HTTP 触发器创建后未返回公网地址");
  console.log("PUBLIC_URL=" + url);
}

main().catch((error) => {
  console.error("DEPLOY_ERR=" + (error.message || error));
  if (error.data) console.error("DETAIL=" + JSON.stringify(error.data));
  process.exit(1);
});
