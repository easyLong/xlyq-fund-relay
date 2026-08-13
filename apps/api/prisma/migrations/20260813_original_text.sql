-- Store the source copy supplied by the fund company. It is released to an executor only after claim.
ALTER TABLE tasks
  ADD COLUMN original_text LONGTEXT NULL AFTER description;

UPDATE tasks
SET original_text = CASE id
  WHEN 1 THEN '基金公司原文：围绕稳健理财场景，介绍长期投资与资产配置理念。内容须客观、真实、合规，不得承诺收益。'
  WHEN 2 THEN '基金公司原文：本期内容请聚焦稳健理财与长期陪伴，结合真实生活场景说明产品特色，避免绝对化和收益保证表述。'
  WHEN 3 THEN '基金公司原文：请根据任务说明完成内容发布，并保留公开链接和发布截图，确保提交材料真实、完整、可核验。'
  WHEN 4 THEN '基金公司原文：教师节主题内容应自然融入长期投资、家庭陪伴和教育规划场景，表达真实克制，不得夸大收益。'
  ELSE '基金公司原文：请依据运营任务要求完成内容发布，确保信息真实、完整并符合平台及宣传合规要求。'
END
WHERE original_text IS NULL;
