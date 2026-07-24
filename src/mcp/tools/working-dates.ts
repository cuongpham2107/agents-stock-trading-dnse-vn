import { API_BASE_URL, type DnseServer } from "../server.ts";

export const getMarketWorkingDatesSchema = {};

export async function getMarketWorkingDates(
  server: DnseServer
): Promise<string> {
  const path = "/market/working-dates";
  const url = `${API_BASE_URL}${path}`;

  return server.getJson(path, url);
}
