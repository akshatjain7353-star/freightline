import axios from "axios";
import { env, delhiveryBaseUrl } from "../../config/env.js";

export const delhiveryHttp = axios.create({
  baseURL: delhiveryBaseUrl(),
  headers: {
    Authorization: `Token ${env.DELHIVERY_API_KEY}`,
  },
  timeout: 15_000,
});
