import axios from "axios";
import { env, delhiveryBaseUrl } from "../../config/env.js";

export const delhiveryHttp = axios.create({
  baseURL: delhiveryBaseUrl(),
  timeout: 15_000,
});

if (env.DELHIVERY_API_KEY) {
  delhiveryHttp.defaults.headers.common.Authorization = `Token ${env.DELHIVERY_API_KEY}`;
}
