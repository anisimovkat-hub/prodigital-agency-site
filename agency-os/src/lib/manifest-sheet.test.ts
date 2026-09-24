import { describe, expect, it } from "vitest";

import { parseCsv, parseTelegramDistribution, parseVkDays } from "./manifest-sheet";

describe("Manifest advertising spreadsheet", () => {
  it("reads quoted CSV and keeps VK expense without VAT with its campaign goal", () => {
    const rows = parseCsv('Дата,ID кабинета,Кабинет,ID кампании,Кампания,"Расход без НДС, RUB",Показы,Клики,Результат,Цель кампании\r\n01.09.2026,16765724,ПРИН,27494641,"Каталог, товары","314,50",6895,29,27,Просмотр карточки товара\r\n');
    expect(parseVkDays(rows)).toEqual([{
      platform: "vk", accountExternalId: "16765724", accountName: "ПРИН",
      campaignExternalId: "27494641", campaignName: "ПРИН · Каталог, товары",
      direction: "ПРИН", date: "2026-09-01", spend: 314.5,
      impressions: 6895, clicks: 29, goal: "vk:Просмотр карточки товара", results: 27,
    }]);
  });

  it("uses the project allocation instead of the Telegram account total", () => {
    const rows = parseCsv('Telegram Ads — распределение по проектам\n\nДата,Проект,"Расход, TON",Показы,Клики,CTR,"CPC, TON","Цели (actions)","Вступления (joins)","Цена вступления, TON","Расход, RUB"\n23.09.2026,СОДА,"0,266",133,1,"0,75%","0,266",0,0,,"₽31,96"\n23.09.2026,ПРИН,"0,000",0,0,"0,00%","0,000",0,0,,"₽0,00"\n');
    const metrics = parseTelegramDistribution(rows);
    expect(metrics).toHaveLength(2);
    expect(metrics.map((row) => row.spend)).toEqual([31.96, 0]);
    expect(metrics.map((row) => row.campaignName)).toEqual(["СОДА · Telegram Ads", "ПРИН · Telegram Ads"]);
  });
});
