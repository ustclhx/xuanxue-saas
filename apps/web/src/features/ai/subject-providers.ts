/**
 * 项目注册的对话对象类型（add-subject-chat design 决策 2）。模板只在此放示例注释，
 * 项目创建后模板不再修改本文件，template-sync 不会产生冲突。
 *
 * 每种类型一行注册调用，provider 实现放在各自的功能目录；并行 change 各加各的行，冲突时保留两边。
 */

import { DAILY_SUBJECT, dailySubjectProvider } from '../daily/subject.ts'
import {
  CHART_RESULT_SUBJECT,
  chartResultSubjectProvider,
  READING_SUBJECT,
  readingSubjectProvider,
} from '../readings/subjects.ts'
import { registerConversationSubject } from './subjects.ts'

// 付费报告与免费结果（adopt-subject-chat-readings design 决策 1）
registerConversationSubject(READING_SUBJECT, readingSubjectProvider)
registerConversationSubject(CHART_RESULT_SUBJECT, chartResultSubjectProvider)
// 今日面板「把今天带去问 AI」（add-birth-profiles-daily-horoscope design D10）
registerConversationSubject(DAILY_SUBJECT, dailySubjectProvider)
