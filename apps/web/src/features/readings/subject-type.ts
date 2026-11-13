/**
 * 报告追问的对象类型（adopt-subject-chat-readings design 决策 1）。单独成文件、不依赖数据库包，
 * 供浏览器端的追问区与服务端的列表过滤、删除逻辑共同引用。
 */
export const READING_SUBJECT_TYPE = 'reading'
