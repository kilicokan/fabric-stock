import * as workOrdersApi from './fason/work-orders/index';

export default function handler(req, res) {
    return workOrdersApi.mobileWorkOrdersPublicHandler(req, res);
}


