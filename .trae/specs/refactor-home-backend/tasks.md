# 首页后端功能重构任务列表

## Task 1: 创建类型定义文件
- [x] SubTask 1.1: 创建梦境相关类型定义
  - [x] 创建 `backend/src/types/dream.types.ts`
  - [x] 定义 DreamEntity 接口
  - [x] 定义 DreamDetail 接口
  - [x] 定义 DreamListItem 接口
  - [x] 定义 CreateDreamDTO、UpdateDreamDTO
  - [x] 定义 DreamQueryParams 接口

- [x] SubTask 1.2: 创建媒资相关类型定义
  - [x] 创建 `backend/src/types/media.types.ts`
  - [x] 定义 MediaAsset 接口
  - [x] 定义 MediaType 枚举
  - [x] 定义 CreateMediaDTO

- [x] SubTask 1.3: 创建解读相关类型定义
  - [x] 创建 `backend/src/types/interpretation.types.ts`
  - [x] 定义 Interpretation 接口
  - [x] 定义 SymbolInterpretation 接口

## Task 2: 创建Repository层
- [x] SubTask 2.1: 创建梦境Repository
  - [x] 创建 `backend/src/repositories/dream.repository.ts`
  - [x] 实现 findAll 方法（分页查询）
  - [x] 实现 findById 方法（根据ID查询）
  - [x] 实现 findByUserId 方法（根据用户ID查询）
  - [x] 实现 create 方法（创建梦境）
  - [x] 实现 update 方法（更新梦境）
  - [x] 实现 delete 方法（删除梦境）
  - [x] 实现 search 方法（全文搜索）
  - [x] 实现 countByUserId 方法（统计用户梦境数量）

- [x] SubTask 2.2: 创建媒资Repository
  - [x] 创建 `backend/src/repositories/media.repository.ts`
  - [x] 实现 findByDreamId 方法（查询梦境关联媒资）
  - [x] 实现 findImagesByDreamId 方法（查询图片）
  - [x] 实现 findVideosByDreamId 方法（查询视频）
  - [x] 实现 findStoriesByDreamId 方法（查询长视频）
  - [x] 实现 countByDreamId 方法（统计媒资数量）

- [x] SubTask 2.3: 创建音频Repository
  - [x] 创建 `backend/src/repositories/audio.repository.ts`
  - [x] 实现 findById 方法（查询音频）
  - [x] 实现 findByDreamId 方法（查询梦境关联音频）

- [x] SubTask 2.4: 创建解读Repository
  - [x] 创建 `backend/src/repositories/interpretation.repository.ts`
  - [x] 实现 findByDreamId 方法（查询梦境解读）
  - [x] 实现 existsByDreamId 方法（检查是否存在解读）

## Task 3: 完善Service层
- [x] SubTask 3.1: 重构DreamService
  - [x] 修改 `backend/src/services/DreamService.ts`
  - [x] 注入 Repository 依赖
  - [x] 实现 getDreamList 方法（获取梦境列表）
  - [x] 实现 getDreamDetail 方法（获取梦境详情）
  - [x] 实现 createDream 方法（创建梦境）
  - [x] 实现 updateDream 方法（更新梦境）
  - [x] 实现 deleteDream 方法（删除梦境）
  - [x] 实现 searchDreams 方法（搜索梦境）
  - [x] 实现 getDreamWorks 方法（获取梦境作品）

- [x] SubTask 3.2: 创建QuotaService（额度服务）
  - [x] 创建 `backend/src/services/quota.service.ts`
  - [x] 实现 getUserQuota 方法（获取用户额度）
  - [x] 实现 checkQuota 方法（检查额度）
  - [x] 实现 consumeQuota 方法（消耗额度）
  - [x] 实现 getQuotaLimits 方法（获取额度限制配置）

## Task 4: 重构Controller层
- [x] SubTask 4.1: 重构DreamController
  - [x] 修改 `backend/src/controllers/DreamController.ts`
  - [x] 注入 Service 依赖
  - [x] 实现 getDreams 方法（处理获取列表请求）
  - [x] 实现 getDreamById 方法（处理获取详情请求）
  - [x] 实现 createDream 方法（处理创建请求）
  - [x] 实现 updateDream 方法（处理更新请求）
  - [x] 实现 deleteDream 方法（处理删除请求）
  - [x] 实现 getDreamWorks 方法（处理获取作品请求）
  - [x] 统一使用 ApiResponse 响应格式

## Task 5: 更新路由配置
- [x] SubTask 5.1: 更新梦境路由
  - [x] 修改 `backend/src/routes/dreamRoutes.ts`
  - [x] 配置 GET /api/dreams 路由
  - [x] 配置 GET /api/dreams/:id 路由
  - [x] 配置 POST /api/dreams 路由
  - [x] 配置 PUT /api/dreams/:id 路由
  - [x] 配置 DELETE /api/dreams/:id 路由
  - [x] 配置 GET /api/dreams/:id/works 路由
  - [x] 添加认证中间件

- [x] SubTask 5.2: 更新主路由索引
  - [x] 修改 `backend/src/routes/index.ts`
  - [x] 确保梦境路由正确注册

## Task 6: 创建错误处理
- [x] SubTask 6.1: 创建梦境相关错误类
  - [x] 在 `backend/src/utils/errors.ts` 中添加
  - [x] DreamNotFoundError（梦境不存在）
  - [x] DreamAccessDeniedError（无权访问）
  - [x] InvalidDreamDataError（数据验证失败）

## Task 7: 集成与测试
- [x] SubTask 7.1: 依赖注入配置
  - [x] 创建 Repository 实例
  - [x] 创建 Service 实例并注入 Repository
  - [x] 创建 Controller 实例并注入 Service

- [x] SubTask 7.2: 编译检查
  - [x] 运行 TypeScript 编译检查
  - [x] 修复类型错误

- [x] SubTask 7.3: API测试
  - [x] 测试梦境列表接口
  - [x] 测试梦境详情接口
  - [x] 测试梦境创建接口
  - [x] 测试梦境更新接口
  - [x] 测试梦境删除接口
  - [x] 测试梦境作品接口

# Task Dependencies
- Task 2 依赖于 Task 1（类型定义）
- Task 3 依赖于 Task 2（Repository层）
- Task 4 依赖于 Task 3（Service层）
- Task 5 依赖于 Task 4（Controller层）
- Task 6 可以与其他任务并行
- Task 7 依赖于所有其他任务完成
