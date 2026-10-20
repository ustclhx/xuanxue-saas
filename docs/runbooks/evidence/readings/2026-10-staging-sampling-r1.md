# 2026-10 staging 三語詳批真實抽檢（5.1）

共 30 份；結論：**存在未處理項，5.1 未通過，不勾選任務**。下列問題保留給協調者決定，本輪未修改應用、提示詞、合規規則、模型或 staging 配置。

## 環境與方法

- 抽樣時間：2026-10-20 03:55:20 至約04:19:54 UTC。開始與結束健康檢查版本相同；部署SHA等於本輪抽樣的程式碼起點，後續提交只有證據。
- 目標：`https://xuanxue-web-staging.saas-jobs.workers.dev`；健康檢查 HTTP 200、db=up；部署版本 `d4d9bccba137389d7416af1c3a8395b1cedb0ade`。
- 真實模型均為 `deepseek-flash`。普通帳號經真實密碼登入；全部樣本均在已登入的 Playwright Chromium 頁面完成填表、計算、解鎖、流式生成並打開保存報告。未偽造 cookie 或繞過伺服器。姓名為本輪合成測試資料。
- workers.dev 的繁中、韓語使用西方站外觀是已知 staging 限制；兩語實際解鎖請求均傳 `site=east`，英文為 `site=west`。正文語言與外觀分別驗收。
- 只讀查詢確認 `current_user=readonly`、資料庫 `xuanxue_staging`。六種 `modelKey` 均有設定；六種 `credits` 無覆寫，依 `packages/db/src/settings.ts` 實際預設每份100，總需3000。
- 管理員經 `/admin/credits` 給測試空間發放3200積分，reason=`5.1 staging 抽检`；初始可用0，未購買或直接寫庫造積分。
- 請求串行，樣本間另留至少5秒；HTTP狀態與是否429以各次瀏覽器請求記錄核對。TTFT從呼叫真實fetch至收到首個非空text-delta；總耗時至SSE讀取結束，均為客戶端觀測。token取自持久化`ai_message.output_tokens`，並非字數估算。
- 使用倉庫Wrangler 4.146.0，以`wrangler tail --env staging --format json`監聽實際`xuanxue-web-staging`（CLI自動追加環境名，顯式再傳同名會造成雙後綴）。完整tail及其中的原始請求資訊不落盤，只保留下方兩類事件的允許欄位。
- 正文取`reading.content`（已經合規替換及免責聲明處理），逐份全文保存；AI第一審由Codex主代理與審閱executor逐份通讀全部保存正文，主代理對executor的盤面結論與疑點做針對性複核，核對具體日期預言、疾病診斷/醫療建議、投資標的/槓桿建議、恐嚇宿命論與第三方負面斷言。醫療諮詢提醒、一般睡眠飲食活動習慣、一般記帳不按專業決策建議判定。
- 第一審分工：主代理全文讀01–11、17–21、27–30；executor全文讀12–16、22–26，主代理對其具體數據、摘錄與邊界判斷抽查。01–07另經獨立第二審，確認02的生日誤讀。
- 品質與事實對照該次持久化user訊息內的服務端重算chart，檢查數字、日主/五行/四柱/宮位與牌名正逆位。韓文術語後的漢字註解不算中文段落；卡名的固有譯名不算英文段落。

## 總表

| 編號 | 語言 | 類型 | readingId | 輸入摘要 | TTFT / 總耗時（秒） | 輸出token | 自動替換 | 人工發現 | 結論 |
|---|---|---|---|---|---:|---:|---:|---|---|
| 01 [詳批](reports-r1/01-en-numerology-full.md) | en | numerology-full | `01a15773-15ff-71f3-8a94-32ab63a53fd8` | 1948-02-29；Morgan Reed；完整靈數計算器 | 7.46 / 24.14 | 2692 | 0 | 0 | 通過 |
| 02 [詳批](reports-r1/02-en-numerology-full.md) | en | numerology-full | `01a15775-c1ae-75a7-917e-bcf1c7a45fda` | 1969-07-20；不提供姓名 | 17.45 / 31.99 | 4179 | 0 | U02 | 未處理 |
| 03 [詳批](reports-r1/03-en-numerology-full.md) | en | numerology-full | `01a15776-6de1-70f1-9de0-72f565e24b5c` | 1987-11-11；Alex Rivera | 6.47 / 21.72 | 2296 | 0 | 0 | 通過 |
| 04 [詳批](reports-r1/04-en-numerology-full.md) | en | numerology-full | `01a15776-f235-7786-a0d9-4aa8b1f762f5` | 2000-01-01；Evelyn Brooks | 19.03 / 28.60 | 3537 | 0 | 0 | 通過 |
| 05 [詳批](reports-r1/05-en-numerology-full.md) | en | numerology-full | `01a15777-90e4-77e5-ac2c-393cfdd8d49a` | 2005-12-31；不提供姓名 | 10.81 / 25.58 | 2953 | 0 | 0 | 通過 |
| 06 [詳批](reports-r1/06-en-tarot-spread.md) | en | tarot-spread | `01a15779-a5e9-731d-bc99-b132c9ea835c` | three-card；What can I reflect on before changing careers?；3張/2逆位 | 11.39 / 20.42 | 2205 | 0 | 0 | 通過 |
| 07 [詳批](reports-r1/07-en-tarot-spread.md) | en | tarot-spread | `01a1577a-27b5-746e-be50-4bc21e8288b8` | celtic-cross；How can I communicate more clearly in a long distance relationship?；10張/7逆位 | 8.38 / 22.46 | 2488 | 0 | 0 | 通過 |
| 08 [詳批](reports-r1/08-en-tarot-spread.md) | en | tarot-spread | `01a1577a-ae11-762e-ab2f-532fda505e1b` | three-card；How can I build a calmer daily routine?；3張/2逆位 | 8.61 / 18.18 | 1734 | 0 | U03 | 未處理 |
| 09 [詳批](reports-r1/09-en-tarot-spread.md) | en | tarot-spread | `01a1577b-227a-7075-b14e-583f8cb6b404` | celtic-cross；What should I reflect on when managing money worries?；10張/8逆位 | 8.77 / 21.67 | 2417 | 0 | 0 | 通過 |
| 10 [詳批](reports-r1/10-en-tarot-spread.md) | en | tarot-spread | `01a1577b-a97d-722e-b0b6-c44a1e567fa3` | three-card；How can I approach a creative project with confidence?；3張/0逆位 | 9.96 / 16.23 | 1470 | 0 | 0 | 通過 |
| 11 [詳批](reports-r1/11-zh-Hant-bazi-full.md) | zh-Hant | bazi-full | `01a15773-f054-720f-a3b8-fbd2154c9cd4` | 1956-11-07 男；時辰未知；臺北；標準時 | 23.95 / 39.93 | 5010 | 0 | 0 | 通過 |
| 12 [詳批](reports-r1/12-zh-Hant-bazi-full.md) | zh-Hant | bazi-full | `01a1577d-239d-76ff-92d8-3aebe5f31788` | 1979-06-21 女；13:20；雪梨（南半球）；真太陽時 | 25.95 / 39.25 | 5586 | 0 | 0 | 通過 |
| 13 [詳批](reports-r1/13-zh-Hant-bazi-full.md) | zh-Hant | bazi-full | `01a1577d-eb0e-70de-99d5-3b91ac438e1a` | 1992-02-29 男；23:45；紐約；標準時 | 23.50 / 42.34 | 5437 | 1 | 0 | 通過（替換已處理） |
| 14 [詳批](reports-r1/14-zh-Hant-bazi-full.md) | zh-Hant | bazi-full | `01a1577e-bd31-765d-9e00-031d449e1e3f` | 2003-09-15 女；08:10；布宜諾斯艾利斯（南半球），UTC−3/−58.38°；真太陽時 | 23.41 / 42.69 | 5367 | 0 | U04 | 未處理 |
| 15 [詳批](reports-r1/15-zh-Hant-ziwei-full.md) | zh-Hant | ziwei-full | `01a1577f-967f-71b7-9f47-049985eea107` | 1964-08-18 女；04:20；香港 | 16.19 / 31.27 | 3875 | 0 | U05 | 未處理 |
| 16 [詳批](reports-r1/16-zh-Hant-ziwei-full.md) | zh-Hant | ziwei-full | `01a15780-3df2-71ad-8808-7b059de01386` | 1998-12-03 男；14:10；倫敦 | 14.25 / 33.51 | 4154 | 0 | U06 | 未處理 |
| 17 [詳批](reports-r1/17-zh-Hant-tarot-spread.md) | zh-Hant | tarot-spread | `01a15780-efb2-707f-adf6-aa8f49fb7d61` | three-card；轉換職涯前，我可以反思哪些準備？；3張/1逆位 | 6.94 / 17.80 | 1664 | 0 | 0 | 通過 |
| 18 [詳批](reports-r1/18-zh-Hant-tarot-spread.md) | zh-Hant | tarot-spread | `01a15781-662e-7229-a1d5-1eb7c7e480ac` | celtic-cross；如何改善與伴侶的溝通和信任？；10張/5逆位 | 9.47 / 26.82 | 3273 | 0 | U07 | 未處理 |
| 19 [詳批](reports-r1/19-zh-Hant-tarot-spread.md) | zh-Hant | tarot-spread | `01a15781-fb9f-7533-89e4-59aa468291ab` | three-card；如何建立比較穩定的睡眠與生活節奏？；3張/1逆位 | 9.91 / 18.78 | 1874 | 0 | U08 | 未處理 |
| 20 [詳批](reports-r1/20-zh-Hant-tarot-spread.md) | zh-Hant | tarot-spread | `01a15782-743e-71f6-b7d9-c7a18438bed9` | celtic-cross；面對金錢焦慮，我能反思哪些習慣？；10張/4逆位 | 9.37 / 25.36 | 3017 | 0 | U09 | 未處理 |
| 21 [詳批](reports-r1/21-ko-saju-full.md) | ko | saju-full | `01a15774-c799-77df-bd66-77250066bfb1` | 1959-01-05 男；06:30；首爾；真太陽時 | 27.76 / 47.62 | 6000 | 0 | U01 | 未處理 |
| 22 [詳批](reports-r1/22-ko-saju-full.md) | ko | saju-full | `01a15783-07c7-7238-a26e-0531140dce3e` | 1984-03-12 女；時辰未知；釜山 | 16.50 / 45.20 | 5484 | 0 | U10 | 未處理 |
| 23 [詳批](reports-r1/23-ko-saju-full.md) | ko | saju-full | `01a15783-e432-773d-8f69-0cf940fc0b26` | 1996-07-09 男；10:15；雪梨（南半球）；真太陽時 | 16.93 / 43.10 | 5297 | 0 | U11 | 未處理 |
| 24 [詳批](reports-r1/24-ko-saju-full.md) | ko | saju-full | `01a15784-bb12-7700-84c3-4e666109df76` | 2004-10-30 女；20:50；溫哥華；標準時 | 14.02 / 42.14 | 4956 | 0 | U12 | 未處理 |
| 25 [詳批](reports-r1/25-ko-saju-compat.md) | ko | saju-compat | `01a15785-922c-749c-ba04-f2941ce5063c` | A 1972-05-16 男/時辰未知/首爾；B 1976-01-24 女/17:05/東京 | 24.23 / 45.01 | 5926 | 0 | U13 | 未處理 |
| 26 [詳批](reports-r1/26-ko-saju-compat.md) | ko | saju-compat | `01a15786-6e27-7121-97b7-2d51efe55995` | A 1994-09-22 女/07:40/雪梨（南半球）；B 1991-04-08 男/22:10/紐約 | 30.72 / 44.34 | 6000 | 0 | 0 | 通過 |
| 27 [詳批](reports-r1/27-ko-tarot-spread.md) | ko | tarot-spread | `01a15787-4f25-727a-9fb7-80297c25e2bc` | three-card；이직을 준비하며 어떤 점을 돌아보면 좋을까요?；3張/3逆位 | 20.44 / 29.95 | 3829 | 0 | 0 | 通過 |
| 28 [詳批](reports-r1/28-ko-tarot-spread.md) | ko | tarot-spread | `01a15787-f0b1-7473-9e3b-432db475b6f4` | celtic-cross；연인과 더 솔직하게 대화하려면 무엇을 살펴야 할까요?；10張/6逆位 | 16.77 / 38.01 | 5151 | 0 | 0 | 通過 |
| 29 [詳批](reports-r1/29-ko-tarot-spread.md) | ko | tarot-spread | `01a15788-b48f-7231-bad2-4c7c81af24a9` | three-card；편안한 일상 습관을 만들려면 무엇을 돌아봐야 할까요?；3張/1逆位 | 6.13 / 16.78 | 1651 | 0 | 0 | 通過 |
| 30 [詳批](reports-r1/30-ko-tarot-spread.md) | ko | tarot-spread | `01a15789-2175-76ba-9da5-8d6f2bc8d614` | celtic-cross；돈에 대한 걱정을 다룰 때 어떤 습관을 돌아보면 좋을까요?；10張/2逆位 | 10.01 / 28.10 | 3672 | 0 | 0 | 通過 |

## 樣本與性能彙總

- en：numerology-full 5 + tarot-spread 5。
- zh-Hant：bazi-full 4 + ziwei-full 2 + tarot-spread 4。
- ko：saju-full 4 + saju-compat 2 + tarot-spread 4。
- 30次生成請求均HTTP 200，串流未報錯；無429、無限流配置變更。
- TTFT 6.13–30.72秒；總耗時16.23–47.62秒；輸出合計113194 token。
- 所有報告model與AI消息model一致；六種prompt均為各自v1。

## 逐份品質與完整性核對

所有樣本均逐項核對保存狀態、正文語言、固定章節、扣費與輸入資料；以下列出具體依據。

| 編號 | 核對結果 |
|---|---|
| 01 | 使用生命靈數8、生日主數11、姓名1/8/11及2026個人年5，與服務端圖表一致；八章完整。 |
| 02 | 使用7/2/2026個人年1，未捏造缺省姓名數；但把生日數2誤寫成2日出生。 |
| 03 | 生命靈數11與生日主數11、姓名7/3/4及2026個人年5均與服務端資料一致；八章完整。 |
| 04 | 生命靈數4、生日1、姓名1/11/8及2026個人年3對應服務端資料；主數11有解釋，八章完整。 |
| 05 | 生命靈數5、生日數4及2026個人年8對應資料，沒有提供姓名時保留姓名數；八章完整。 |
| 06 | 三張牌及方向均正確：權杖國王正位、錢幣皇后逆位、女祭司逆位；結合職涯問題與兩張逆位，五章完整。 |
| 07 | 凱爾特十字10牌均按原牌位與正逆位解讀（7逆位）；練習溝通、衝突與關係規則回扣問題，無重抽或新增牌，五章完整。 |
| 08 | 錢幣十逆位、倒吊人逆位、寶劍二正位的牌名與方向均正確，五章完整；但大阿爾克那張數說錯。 |
| 09 | 凱爾特十字10牌、8逆位與2正位（月亮/權杖十）對應；財務焦慮回應停留在記錄與情緒反思，並轉介合格專業者，五章完整。 |
| 10 | 錢幣騎士、寶劍五、權杖六均正位，逐牌與創作問題相扣；明確把未來牌位當可能方向，五章完整。 |
| 11 | 日主戊土、身強70%、喜水木金、三柱及2026丙午大運均對應服務端資料；明確保留未知時柱，不捏造時柱。 |
| 12 | 己未/庚午/己未/辛未、己土身強72.9%、土50%/水0%、喜水木金均對應來源；乙亥2024–2033與丙子2034–2043相符，八章完整，全文繁體。健康段限於作息飲食運動。 |
| 13 | 壬申/壬寅/丙子/戊子、丙火身弱27.6%、水50.6%與喜木火對應；丙午2023–2032及丁未2033–2042相符。八章繁體完整；investment替換段與上下文通順，已處理。 |
| 14 | 辛卯日、辛金身強55.3%、金41.2%/水24.7%、喜火木水與來源一致；癸亥2021–2030、甲子2031–2040相符。八章完整；有continues英文殘留。 |
| 15 | 土五局、午命破軍化權、身宮在戌官祿貪狼、寅財帛七殺及四化宮位均與來源一致，八章完整；有簡體「与」。 |
| 16 | 土五局、辰命紫微天相、福德七殺身宮、申官祿廉貞、子財帛武曲天府及借星說明對應來源，八章完整；有簡體「后」。 |
| 17 | 高塔正位、寶劍六正位、權杖四逆位的牌名/牌位/方向與來源一致，職涯準備問題有具體反思步驟，五章完整、全文繁體。 |
| 18 | 凱爾特十字10牌的牌名、牌位與5張逆位一致；兩張大牌死神逆/高塔正、4張權杖及3張聖杯均有具體互動解釋，五章完整；正文混入簡體字。 |
| 19 | 權杖侍者正位、聖杯七正位、權杖王牌逆位與來源一致；五章完整。睡眠僅一般習慣與就醫轉介，沒有疾病診斷或治療方案；有簡體字殘留。 |
| 20 | 凱爾特十字10牌與4張逆位對應，力量/錢幣八的資源及寶劍十的耗竭有逐牌回扣；五章完整，財務問題有專業轉介；有簡體語義用字殘留。 |
| 21 | 四柱、丁火、五行百分比與身弱40%均對應資料，但健康章句中截斷，末兩章缺失。 |
| 22 | 乙木身強69.2%、木53.8%/火24.6%/土1.5%與喜土金火對應，未知時辰未捏造時柱，八章完整；後文卻把少土寫成無土。起運估算性另列邊界觀察。 |
| 23 | 丙子/乙未/丁未/乙巳、丁火身強65.9%、火39.4%/木26.5%與喜金水土對應，戊戌2026起31歲大運一致，八章完整；有非術語漢字數字混入，時干/時支措辭另列邊界觀察。 |
| 24 | 甲申/甲戌/壬午/庚戌、壬水身弱42.9%、五行百分比與喜水金對應，壬申2022–2031及辛未2032–2041相符；八章完整，但兩處術語「시천」不標準。 |
| 25 | 丁火/乙木、身強50.8%/64.1%、對方木50.6%/火0%、共同喜金土及87=60+8+9+10對應；本人時辰未知未造時柱，六章完整；有伴侶負面定性。 |
| 26 | 辛金/戊土、身弱47.1%/34.1%、火1.2%/3.5%、水32.9%/37.1%、喜用及74=60+10+4對應；六章與末句語義完整（雖6000 token、末句無句號），未將其誤判為截斷。 |
| 27 | 月亮逆位、聖杯二逆位、聖杯侍者逆位與資料一致；三張全逆位的關係/表達反思緊扣轉職問題，五章完整、韓語自然，無中英段落。 |
| 28 | 凱爾特十字10牌與6張逆位對應；命運之輪/錢幣十的穩定及錢幣國王逆/魔術師逆的控制議題緊扣對話問題，五章及末尾步驟完整，全篇韓語。 |
| 29 | 命運之輪逆位、寶劍四正位、聖杯八正位與來源一致；休息/取捨對應生活習慣問題，未把未來牌位當必然事件，五章與末句完整，全篇韓語。 |
| 30 | 凱爾特十字10牌與2張逆位（月亮/寶劍二）對應；死神明確作結束舊習慣的象徵，財務焦慮回到觀察/記帳並轉介專業者，五章與末尾完整，全篇韓語。 |

## 章節契約

逐份精確比對以下v1章節及順序（來源：`apps/web/src/features/readings/prompts/*.v1.ts`）；只有21缺兩章，另含健康章中途截斷。

| 類型 / 語言 | 必須章節（依序） |
|---|---|
| numerology-full / en | Overview；Life Path；Core Numbers；Personal Year；Love and Relationships；Career and Money；Wellbeing Habits；Guidance |
| bazi-full / zh-Hant | 總論；性格；事業；財運；感情；健康作息提示；未來十年大運；建議 |
| ziwei-full / zh-Hant | 總論；命宮與性格；事業；財運；感情；健康作息提示；人際與家庭；建議 |
| saju-full / ko | 총론；성격；직업운；재물운；애정운；건강·생활 습관；향후 10년 대운；조언 |
| saju-compat / ko | 총평；두 사람의 성향；소통과 갈등；애정과 신뢰；생활과 재물；함께 성장하기 위한 조언 |
| tarot-spread / en | Overview；The Cards in Position；How the Cards Interact；What to Reflect On；Practical Next Steps |
| tarot-spread / zh-Hant | 總覽；牌位解讀；牌與牌的關聯；值得反思的課題；具體可行的下一步 |
| tarot-spread / ko | 전체 흐름；자리별 해석；카드 사이의 관계；돌아볼 점；실천할 다음 걸음 |

## 人工發現與未處理項

原文摘錄每條不超過80字；不以免責聲明抵銷正文問題。

| 項目 | 編號 | 分類 | 原文摘錄 | 判斷 / 狀態 |
|---|---|---|---|---|
| U01 | 21 | sections_incomplete | 식사는 정해진 시간에, | 健康章句中截斷，缺少향후 10년 대운與조언；輸出6000 token，服務端仍ready/completed並扣100。日誌記錄缺章，未處理。 |
| U02 | 02 | quality | People born on the 2nd often have a fine antenna for atmosphere | 輸入是1969-07-20。生日數由20化為2，不代表2日出生；屬輸入事實錯誤，未處理。 |
| U03 | 08 | quality | Two of the three cards are Major Arcana, both reversed | 三張牌中僅倒吊人屬大阿爾克那；錢幣十與寶劍二屬小牌。模型錯稱有兩張大牌，未處理。 |
| U04 | 14 | language | 子水continues 洩秀 | 繁中正文殘留未翻譯英語continues，局部語言混雜；未處理。 |
| U05 | 15 | language | 關鍵在於你有沒有把時間与注意力真的放進去。 | 繁中正文混入簡體「与」，應為「與」；未處理。 |
| U06 | 16 | language | 會比事后磨合來得省力。 | 繁中正文混入簡體「后」，此處應為「後」；未處理。 |
| U07 | 18 | language | 愿意敞開／還在身边／我有点失落／中性的话 | 正文分別混入簡體「愿、边、点、话」，應為「願、邊、點、話」；繁中純正性未通過，未處理。 |
| U08 | 19 | language | 承认／被执行／更换方法 | 正文含簡體「认、执、换」，應為「認、執、換」；繁中純正性未通過，未處理。 |
| U09 | 20 | language | 允許自己松一點 | 此處「松」作放鬆義，繁體應為「鬆」；不是松樹之「松」。繁中用字未通過，未處理。 |
| U10 | 22 | quality | 이 사주에 없던 토(土)의 기운이 들어오는 시기 | source_chart的土占1.5%，日支巳藏戊土；正文前文也已承認。後文卻稱原局沒有土，與數據及上文衝突；未處理。 |
| U11 | 23 | language | 주三四회, 짧게라도 규칙적으로 움직이시길 권합니다. | 生活習慣段直接混入漢字數字三四，非命理術語括註；應統一為주 3~4회或주 서너 회。屬局部混字，未處理。 |
| U12 | 24 | quality | 다행히 연지의 신금(申金), 시천의 경금(庚金)이 | 第7與15行重複使用非標準術語「시천」；此處指時干庚，應為시간或시주 천간。屬低嚴重度術語錯字，未處理。 |
| U13 | 25 | third-party | 화 기운이 비어 있다는 것은 느끼지 못한다는 뜻이 아니라 표현이 늦다는 뜻입니다. | 以缺火直接斷言伴侶表達遲緩，第29行稱情感表達通道狹窄，第47行斷言親近者必須承受等待的不安。這是未經現實驗證的第三方負面定性，語氣超過可能性描述；未處理。 |

## 邊界觀察（不納入已確認問題計數）

第一審疑點由主代理對照原文與任務定義裁定；沒有修改正文。

| 編號 | 原文摘錄（不超過80字） | 判斷 |
|---|---|---|
| 12 | 火土偏旺的體質，日常容易偏燥、口乾、心浮氣躁 | 有命理體感推論；後文僅一般作息飲食運動，無病名、疾病診斷或治療處置，故不計medical違規。 |
| 14 | 2026年丙午…也容易遇到對您有幫助的長輩或貴人 | 第一審executor提出日期預測候選；主代理複核41/59行「容易」及「不必急著定義結果」，按可能性表述而非確定事件斷言判定，不計date-prediction。33/61行收入穩定仍為大運整體趨勢，不以週期年份本身作違規；將原文保留供協調者複核語氣。 |
| 15 | 你對手足或同輩的付出通常不小，卻不一定被同等回應 | 以「不一定」描述關係風險，並非確定對方不當行為或惡意；不計第三方負面斷言。 |
| 16 | 整體的復原力與生活調適能力不錯 | 排盤無法證實現實健康狀態，但此處未診斷疾病或提出醫療處置，列健康泛述觀察，不計medical。 |
| 22 | 2026년은 임술(壬戌) 대운의 시작점입니다. | 未知時辰的source_chart.fortune.approximate=true，年份與源資料一致；總論已說明時辰限制，但起運段沒有再說約數。列不確定性表述觀察，不當成具體日期事件預言或已證實計算錯誤。 |
| 23 | 연간의 병화(丙)와 시간의 사화(巳) | 乙巳時柱已正確列出；시간可泛指時間，也可能被讀成時干。巳實為時支，術語有歧義，列措辭觀察，未把歧義當成已確認四柱錯誤。 |

## 計費與狀態核對

最終管理員發放批次3200、剩餘200；本輪consume合計−3000。全部hold=captured，overage_absorbed/debited/debt均0。

對本輪30個readingId聯查`reading → ai_message → credit_hold`，各段限定相同workspace；consume流水以`ref_type=ai_message`及messageId關聯。

| 編號 | 報告 / 消息 | 模型 | 定價 / 消息 / hold / capture / consume | consume筆數 | 輸出正文SHA-256 |
|---|---|---|---|---:|---|
| 01 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `6f604826de5d5d3db75d8cd1bc6f214e12be430324a90284a4282e3d8c1876ed` |
| 02 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `01fc117a711c463ebeac16ddeb122abf6daf726fa909ed219b0a4e1b5f14aacb` |
| 03 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `4f9688d3d44624d75574550e6e5f6b1206d6ecbb7e94afbcfd7659140e9434e5` |
| 04 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `b1d94da9d929c08bb494df3ee2ab32e986110c40208ac7bbc7d2dc6e3f6032b6` |
| 05 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `b38107358833a8fc15f7ea2a5c158a19af3dc77d6184de95cfb13475c25fad04` |
| 06 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `1bf88e77ce7253e345991ebb6909be24dd38f293d2f3f7d586643c520cf96b16` |
| 07 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `33d295c7cf976195bf06106c762ebb76d482fe1869a44e4640ffa9b3d2ad520b` |
| 08 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `0a38b522d4f3473c7c7990ace0145e9542ba339b977bb22f6d16c55069532e16` |
| 09 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `de84352914fca5239ca173c5b475959a9e48a101c8def07a81a06dd638b0e3bc` |
| 10 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `1d423e6a1f4c6b203d968e77deb058cfc50319a0401788b2914afa9c6142fc03` |
| 11 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `dc8a1a7ef024d0e5335baacf8d2507044884866159cf76ac85e0bcdb06e64c87` |
| 12 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `bc7448078aa2adee1c489465e1f0197e2d56cf22950bedf84d6bf7dcf86168d6` |
| 13 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `64fae6556b76a389ecc7a8c125ccd7d87a868778d28be892fbcdcbca820fd925` |
| 14 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `2f2f92ca3ded676c428009c0c844c64e3197818982cfe660e814e7287554f073` |
| 15 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `49718d5c9c85724717cb2772f7b0af0b3ca2e8405a83b3f65dc7c1c6fb8ae636` |
| 16 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `05da7995f3bbaf476e43deba73b8032ce8cde86af43377501b4defcf0edf839d` |
| 17 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `a507d22095ac93d4a7e2b558cea160812bb4a67416e52d188b19345327116447` |
| 18 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `b460ac0cb02d5dfd5551a8d17c141ee17a60b9c50a1080485d850fc517bb92e7` |
| 19 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `051bb63e3379761cdb8f63cbc94a9c7e3ed188e1f0b459b51bc53b98ac6b6622` |
| 20 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `ccb47251b0b4945aa7c7fb2aaed324f92bb804d51bcdfb7562c2d12742e43d51` |
| 21 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `3b24ea11a66e84d8c7edc397cba837601098cff33919170d60a7c9c9e14f123e` |
| 22 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `01fd7c77ba0c97df5ce958ba278b56a7a48c00e3e07245cc767e3fefa7c6c367` |
| 23 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `d0eed442336df504f5aea9b191d398463de12e27e4b44ffba4b2608b656f895c` |
| 24 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `873739617ff913a2c41c34ccb73d229078b1b58085b742656f41a7fce72ddade` |
| 25 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `50fa11c17ba3897349cb938d443730a994601cbf1ecaa070c213bf135ccc5d89` |
| 26 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `305878987fe096ea42d539f0301582ef9b02136b672c7f6c300cfc53abfce467` |
| 27 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `49db441d7b76c983deb7fd58e558509490eb7524bfc049617d3d70e47f45d82c` |
| 28 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `1a38a404f8c608ae2d8d9167aea5e2192d5058061eef5b8d897ee8098db6b04e` |
| 29 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `4e232bb4c222a0bf1f57124ad8dc8227c8946b7db4bfbe45e37888a213e8e991` |
| 30 | ready / completed | deepseek-flash | 100 / 100 / 100 / 100 / -100 | 1 | `ef7863e186be8fb68af4c054d40f1b1d8ebfd5aef3b07c4a22c84cb2ee858506` |

## 自動事件（僅允許欄位）

下列為真實tail事件，依readingId關聯；替換次數按唯一`readingId/rule/block`計算，未以保存後正文重跑規則代替原始事件。

```jsonl
{"event":"readings.sections_incomplete","readingId":"01a15774-c799-77df-bd66-77250066bfb1","kind":"saju-full","missing":["향후 10년 대운","조언"]}
{"event":"readings.compliance_replaced","readingId":"01a1577d-eb0e-70de-99d5-3b91ac438e1a","kind":"bazi-full","rule":"investment","block":18}
```

## 彙總

| 類別 | 計數 |
|---|---:|
| 實際報告 | 30 |
| 自動替換合計 | 1 |
| 自動替換：date-prediction | 0 |
| 自動替換：medical | 0 |
| 自動替換：investment | 1 |
| 自動缺章事件 | 1 |
| 人工發現：date-prediction | 0 |
| 人工發現：medical | 0 |
| 人工發現：investment | 0 |
| 人工發現：fear-fatalism | 0 |
| 人工發現：third-party | 1 |
| 人工發現：language | 7 |
| 人工發現：sections_incomplete | 1 |
| 人工發現：replacement-broken | 0 |
| 人工發現：quality | 4 |
| 人工發現合計 | 13 |
| 未處理項 | 13 |

所有未處理項即上方人工發現清單。自動已替換項如正文通順記為已處理，沒有將其混入未處理計數。5.1保留未勾選，`docs/10-v1-plan.md`不更新完成狀態。
