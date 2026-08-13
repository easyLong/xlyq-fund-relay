-- Repair the earlier local verification task so it is readable in the mobile UI.
UPDATE tasks
SET
  title = '内容发布与截图提交测试任务',
  description = '围绕稳健理财场景发布一条真实、合规、可追踪的内容，并提交发布链接和截图。',
  platform = '小红书',
  campaign_name = '稳健理财内容验证',
  submit_requirements = JSON_OBJECT('fields', JSON_ARRAY('发布链接', '内容截图'), 'note', '内容需保留公开可访问链接'),
  compliance_requirements = '不得承诺收益，不得使用绝对化表述，权益信息必须与活动资料一致。'
WHERE id = 3;

UPDATE task_submissions
SET
  text_content = '已完成内容发布，截图用于验证任务提交流程。',
  content = JSON_OBJECT('screenshots', JSON_ARRAY(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  ))
WHERE id = 2;
