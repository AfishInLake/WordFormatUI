import axios from 'axios';
// 创建axios实例
const service = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', // 从环境变量获取基础URL
    timeout: 10000, // 请求超时时间
    headers: {
        'Content-Type': 'application/json;charset=UTF-8'
    }
});

// 请求拦截器
service.interceptors.request.use(
    (config) => {
        // 在发送请求之前做些什么
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // 如果是GET请求，添加时间戳防止缓存
        if (config.method === 'get') {
            config.params = {
                ...config.params,
                _t: Date.now()
            };
        }

        return config;
    },
    (error) => {
        // 对请求错误做些什么
        return Promise.reject(error);
    }
);

// 响应拦截器
service.interceptors.response.use(
    (response) => {
        // 对响应数据做点什么
        const res = response.data;

        // 根据后端返回的数据结构进行调整
        // 如果后端返回的数据有固定的格式，比如 { code: 200, data: {}, message: 'success' }
        if (res.code !== undefined && (res.code < 200 || res.code >= 300)) {
            // 业务逻辑错误
            return Promise.reject(new Error(res.message || 'Error'));
        }

        if (res.success === false) {
            return Promise.reject(new Error(res.message || '操作失败'));
        }

        // 返回整个响应数据，让具体业务处理
        return res;
    },
    (error) => {
        // 对响应错误做点什么
        let message = '请求失败';

        if (error.response) {
            // 服务器返回错误状态码
            switch (error.response.status) {
                case 400:
                    message = '请求错误';
                    break;
                case 401:
                    message = '未授权，请重新登录';
                    // 清除token并跳转到登录页
                    localStorage.removeItem('token');
                    sessionStorage.removeItem('token');
                    window.location.href = '/login';
                    break;
                case 403:
                    message = '拒绝访问';
                    break;
                case 404:
                    message = '请求地址不存在';
                    break;
                case 500:
                    message = '服务器内部错误';
                    break;
                default:
                    message = `连接错误 ${error.response.status}`;
            }
        } else if (error.request) {
            // 请求成功发出，但没有收到响应
            message = '网络连接异常，请检查网络';
        } else {
            // 发送请求时出了点问题
            message = error.message;
        }

        return Promise.reject(new Error(message));
    }
);

// 封装通用请求方法
class ApiClient {
    // GET请求
    get(url, params = {}, config = {}) {
        return service({
            method: 'get',
            url,
            params,
            ...config
        });
    }

    // POST请求
    post(url, data = {}, config = {}) {
        return service({
            method: 'post',
            url,
            data,
            ...config
        });
    }

    // PUT请求
    put(url, data = {}, config = {}) {
        return service({
            method: 'put',
            url,
            data,
            ...config
        });
    }

    // PATCH请求
    patch(url, data = {}, config = {}) {
        return service({
            method: 'patch',
            url,
            data,
            ...config
        });
    }

    // DELETE请求
    delete(url, params = {}, config = {}) {
        return service({
            method: 'delete',
            url,
            params,
            ...config
        });
    }

    // 上传文件
    upload(url, formData, onProgress = null) {
        return service.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    onProgress(percentCompleted);
                }
            }
        });
    }

    // 下载文件
    download(url, params = {}, filename = 'download') {
        return service({
            method: 'get',
            url,
            params,
            responseType: 'blob'
        }).then(response => {
            // 创建blob链接，模拟a标签点击下载
            const blob = new Blob([response]);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(downloadUrl);
        });
    }
}

// 创建实例
const request = new ApiClient();

export default request;