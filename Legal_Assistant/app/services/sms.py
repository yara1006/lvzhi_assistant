"""
阿里云短信认证服务 - 使用官方推荐配套API
"""
import os
import random
from typing import Tuple
from pathlib import Path

from dotenv import load_dotenv
from alibabacloud_dypnsapi20170525.client import Client
from alibabacloud_dypnsapi20170525.models import (
    GetSmsAuthTokensRequest,
    VerifySmsCodeRequest,
    CheckSmsVerifyCodeRequest  # 保留作为备选
)
from alibabacloud_tea_openapi import models as open_api_models

# 加载 .env 文件中的环境变量
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def get_sms_client():
    """获取阿里云短信客户端"""
    config = open_api_models.Config(
        access_key_id=os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_ID'),
        access_key_secret=os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
    )
    config.endpoint = 'dypnsapi.aliyuncs.com'
    return Client(config)

def send_verification_code(phone_number: str) -> Tuple[bool, str]:
    """
    发送短信验证码 - 使用 GetSmsAuthTokens 接口
    """
    try:
        client = get_sms_client()
        
        request = GetSmsAuthTokensRequest(
            phone_number=phone_number,
            sign_name=os.environ.get('ALIBABA_SMS_SIGN_NAME', '速通互联验证码'),
            template_code=os.environ.get('ALIBABA_SMS_TEMPLATE_CODE', '100001'),
            scheme_code=os.environ.get('ALIBABA_SMS_SCHEME_CODE', 'FC220000012490307')
        )
        response = client.get_sms_auth_tokens(request)
        
        if response.body.code == 'OK':
            # 发送成功，可以打印日志
            print(f"验证码已发送到 {phone_number}")
            return True, "验证码发送成功"
        else:
            return False, response.body.message
    except Exception as e:
        return False, str(e)

def verify_code(phone_number: str, code: str) -> Tuple[bool, str]:
    """
    校验验证码 - 使用 VerifySmsCode 接口
    """
    try:
        client = get_sms_client()
        
        # 生成一个随机会话ID（用于关联发送和校验）
        session_id = str(random.randint(100000, 999999))
        
        request = VerifySmsCodeRequest(
            phone_number=phone_number,
            verify_code=code,
            session_id=session_id
        )
        response = client.verify_sms_code(request)
        
        if response.body.code == 'OK':
            return True, "验证码正确"
        else:
            return False, response.body.message
    except Exception as e:
        return False, str(e)
