/**
 * 用户路由
 * 处理用户认证、用户管理、订阅等相关路由
 */

import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// ==================== 认证相关 ====================

/**
 * @route   GET /auth/check-phone
 * @desc    检查手机号是否已注册
 * @access  Public
 */
router.get('/auth/check-phone', userController.checkPhoneExists.bind(userController));

/**
 * @route   POST /auth/register
 * @desc    用户注册
 * @access  Public
 */
router.post('/auth/register', userController.register.bind(userController));

/**
 * @route   POST /auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post('/auth/login', userController.login.bind(userController));

/**
 * @route   POST /auth/anonymous
 * @desc    匿名登录
 * @access  Public
 */
router.post('/auth/anonymous', userController.anonymousLogin.bind(userController));

/**
 * @route   POST /auth/refresh
 * @desc    刷新 Token
 * @access  Public
 */
router.post('/auth/refresh', userController.refreshToken.bind(userController));

/**
 * @route   POST /auth/logout
 * @desc    退出登录
 * @access  Private
 */
router.post('/auth/logout', authenticate, userController.logout.bind(userController));

// ==================== 用户资料相关 ====================

/**
 * @route   GET /users/profile
 * @desc    获取完整用户资料
 * @access  Private
 */
router.get('/users/profile', authenticate, userController.getUserProfile.bind(userController));

/**
 * @route   PUT /users/profile
 * @desc    更新用户资料
 * @access  Private
 */
router.put('/users/profile', authenticate, userController.updateProfile.bind(userController));

/**
 * @route   PUT /users/settings/theme
 * @desc    更新主题设置
 * @access  Private
 */
router.put('/users/settings/theme', authenticate, userController.updateTheme.bind(userController));

/**
 * @route   GET /users/quota
 * @desc    获取用户额度
 * @access  Private
 */
router.get('/users/quota', authenticate, userController.getUserQuota.bind(userController));

// ==================== 订阅相关 ====================

/**
 * @route   GET /subscriptions/plans
 * @desc    获取订阅方案
 * @access  Public/Private
 */
router.get('/subscriptions/plans', userController.getSubscriptionPlans.bind(userController));

/**
 * @route   POST /subscriptions
 * @desc    创建订阅
 * @access  Private
 */
router.post('/subscriptions', authenticate, userController.createSubscription.bind(userController));

/**
 * @route   GET /subscriptions/current
 * @desc    获取当前订阅
 * @access  Private
 */
router.get('/subscriptions/current', authenticate, userController.getCurrentSubscription.bind(userController));

/**
 * @route   DELETE /subscriptions
 * @desc    取消订阅
 * @access  Private
 */
router.delete('/subscriptions', authenticate, userController.cancelSubscription.bind(userController));

export default router;
