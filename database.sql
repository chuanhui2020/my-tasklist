-- 个人任务管理系统数据库初始化脚本
-- 创建任务表

CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL COMMENT '任务标题',
    description TEXT COMMENT '任务描述',
    status ENUM('pending','done') DEFAULT 'pending' COMMENT '任务状态',
    due_date DATE NULL COMMENT '截止日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务表';

-- 插入示例数据
INSERT INTO tasks (title, description, status, due_date) VALUES
('完成项目文档', '编写项目的README文档和API文档', 'pending', '2024-01-20'),
('学习Vue 3新特性', '深入学习Vue 3的Composition API和新功能', 'pending', '2024-01-25'),
('代码重构', '重构旧项目中的核心模块，提升代码质量', 'done', '2024-01-15'),
('准备技术分享', '准备下周的技术分享PPT', 'pending', '2024-01-22'),
('修复bug #123', '修复用户反馈的登录问题', 'done', NULL);

-- 查看表结构
DESCRIBE tasks;

-- 查看示例数据
SELECT * FROM tasks;