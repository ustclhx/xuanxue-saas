# Spec Delta

## Purpose

规定西方站 angel numbers 枢纽与数字页：数字范围、按语言本地主词另写，以及与数字命理页的关系。

## ADDED Requirements

### Requirement: angel numbers 枢纽与数字页

西方站 SHALL 在 en 提供 angel numbers 枢纽与约 30 个高搜索量数字页（如 111、222、333、444、555、777、1111），不铺满 000–999。每页 SHALL 从数字命理角度给出逐页撰写的解读，链接到相关生命灵数页。

#### Scenario: 枢纽列出全部数字

- **WHEN** 访客打开 angel numbers 枢纽
- **THEN** 页面列出全部已发布数字页的链接，未发布的数字没有链接

### Requirement: 按语言本地主词另写

其他语言 SHALL 以本语言主词另写，不直译 en：es 用「números angelicales」一类主词；pt-BR 的「horas iguais」与 fr 的「heures miroirs」 SHALL 等该语言在站点上线后再做。各语言数字集合可以不同，hreflang 只列已发布的对应页。

#### Scenario: es 只有部分数字

- **WHEN** es 只发布了 20 个数字
- **THEN** 其余数字的 en 页 hreflang 不含 es
