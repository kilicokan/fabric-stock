import { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import { TokenPayload, verifyToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withCors } from '@/lib/cors';
import { Prisma, ProcessStatus, ProcessType } from '@prisma/client';
import { checkAssignmentAgainstRoute, parseStoredRoute, resolveProcessTypeForWorkshop } from '@/lib/product-route';

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown error';

const isProcessType = (value: unknown): value is ProcessType =>
    typeof value === 'string' && Object.values(ProcessType).includes(value as ProcessType);


async function handler(req: NextApiRequest, res: NextApiResponse) {

    const user = verifyToken(req.headers.authorization);
    if (!user) {
        return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    }

    try {
        switch (req.method) {
            case 'GET':
                return handleGetAssignments(req, res);
            case 'POST':
                return handleCreateAssignment(req, res, user);
            case 'PUT':
                return handleUpdateAssignment(req, res);
            case 'DELETE':
                return handleDeleteAssignment(req, res);
            case 'PATCH':
                return handlePatchAssignment(req, res, user);
            default:
                return res.status(405).json(errorResponse('Method not allowed'));
        }
    } catch (error) {
        console.error('ÄŸÅ¸â€™Â¥ API Error:', error);
        return res.status(500).json(errorResponse('Internal server error'));
    }
}

// Yeni atama oluÃ…Å¸tur
async function handleCreateAssignment(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
    try {
        const {
            workOrderId,
            workshopId,
            assignedQuantity,
            unitPrice,
            processType: requestedProcessType,
            stepName: requestedStepName,
            notes,
            completeWorkOrder
        } = req.body;

        // Input validation
        if (!workOrderId || !workshopId || !assignedQuantity || unitPrice === undefined) {
            return res.status(400).json(errorResponse('Eksik veya geÃƒÂ§ersiz parametreler', 'VALIDATION_ERROR'));
        }

        const parsedWorkOrderId = parseInt(workOrderId);
        const parsedWorkshopId = parseInt(workshopId);
        const parsedAssignedQuantity = parseInt(assignedQuantity);
        const parsedUnitPrice = parseFloat(unitPrice);

        if (isNaN(parsedWorkOrderId) || isNaN(parsedWorkshopId) || isNaN(parsedAssignedQuantity) || isNaN(parsedUnitPrice)) {
            return res.status(400).json(errorResponse('GeÃƒÂ§ersiz sayÃ„Â± formatÃ„Â±', 'VALIDATION_ERROR'));
        }

        if (parsedAssignedQuantity <= 0 || parsedUnitPrice < 0) {
            return res.status(400).json(errorResponse('Miktar pozitif, fiyat sıfır veya pozitif olmalıdır', 'VALIDATION_ERROR'));
        }

        // processType gönderilmediyse ürün rotası + atölye uzmanlığından çözülür
        let processType: ProcessType;
        let stepName: string | null = null;
        if (requestedProcessType === undefined || requestedProcessType === null || requestedProcessType === '') {
            const [orderForType, workshopForType] = await Promise.all([
                prisma.workOrder.findUnique({
                    where: { id: parsedWorkOrderId },
                    select: { productCode: true, fasonTrackings: { select: { processType: true, status: true, stepName: true } } }
                }),
                prisma.fasonWorkshop.findUnique({
                    where: { id: parsedWorkshopId },
                    select: { specialization: true }
                })
            ]);
            if (!orderForType || !workshopForType) {
                return res.status(404).json(errorResponse('İş emri veya atölye bulunamadı', 'NOT_FOUND'));
            }
            const productForType = await prisma.product.findUnique({
                where: { modelNo: orderForType.productCode },
                select: { routeSteps: true }
            });
            const resolved = resolveProcessTypeForWorkshop(
                parseStoredRoute(productForType?.routeSteps),
                workshopForType.specialization,
                orderForType.fasonTrackings
            );
            if (resolved.ok === false) {
                return res.status(400).json(errorResponse(resolved.message, 'VALIDATION_ERROR'));
            }
            processType = resolved.processType;
            stepName = resolved.stepName ?? null;
        } else if (isProcessType(requestedProcessType)) {
            processType = requestedProcessType;
            if (processType === 'OZEL') {
                const cleanName = typeof requestedStepName === 'string' ? requestedStepName.trim() : '';
                if (!cleanName || cleanName.length > 40) {
                    return res.status(400).json(errorResponse('Özel adım için geçerli bir stepName gerekli', 'VALIDATION_ERROR'));
                }
                stepName = cleanName;
            }
        } else {
            return res.status(400).json(errorResponse('Gecersiz processType', 'VALIDATION_ERROR'));
        }

        // KESİM KONTROLÜ: DIKIM veya UTU ataması yapılıyorsa,
        // KESIM aşamasının TESLIM_EDILDI fasonTracking kaydı olmalı.
        // Transaction dışında kontrol edilir; böylece hata Prisma transaction wrapping'inden kaynaklanmaz.
        if (processType !== 'KESIM') {
            const cuttingTrackings = await prisma.fasonTracking.findMany({
                where: {
                    workOrderId: parsedWorkOrderId,
                    processType: 'KESIM',
                    status: 'TESLIM_EDILDI'
                }
            });

            if (!cuttingTrackings || cuttingTrackings.length === 0) {
                return res.status(400).json(errorResponse(
                    'Bu iş emri için kesim kaydı bulunamadı. Kesim yapılmadan fasona sevk edilemez.',
                    'INVALID_STATE'
                ));
            }
        }

        // ÜRÜN ROTASI KONTROLÜ: ürünün kendi rotasına göre sıradaki adım mı?
        const routeWorkOrder = await prisma.workOrder.findUnique({
            where: { id: parsedWorkOrderId },
            select: { productCode: true, fasonTrackings: { select: { processType: true, status: true, stepName: true } } }
        });
        if (routeWorkOrder) {
            const routeProduct = await prisma.product.findUnique({
                where: { modelNo: routeWorkOrder.productCode },
                select: { routeSteps: true }
            });
            const routeCheck = checkAssignmentAgainstRoute(
                parseStoredRoute(routeProduct?.routeSteps),
                processType,
                routeWorkOrder.fasonTrackings,
                stepName
            );
            if (routeCheck.ok === false) {
                return res.status(400).json(errorResponse(routeCheck.message, 'VALIDATION_ERROR'));
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // Ãƒâ€“nce mevcut atamalarÃ„Â± kontrol et (sadece henÃƒÂ¼z teslim edilmemiÃ…Å¸ olanlarÃ„Â± say)
            const existingAssignments = await tx.fasonTracking.findMany({
                where: {
                    workOrderId: parsedWorkOrderId,
                    status: { not: 'TESLIM_EDILDI' }
                }
            });

            const totalAssigned = existingAssignments.reduce((sum, assignment) => sum + (assignment.assignedQuantity || 0), 0);

            // Ã„Â°Ã…Å¸ emrini getir
            const workOrder = await tx.workOrder.findUnique({
                where: { id: parsedWorkOrderId }
            });

            if (!workOrder) {
                throw new Error('Ã„Â°Ã…Å¸ emri bulunamadÃ„Â±');
            }

// Check if work order is closed
            if (workOrder.status === 'TESLIM_EDILDI') {
                throw new Error('Bu iş emri kapatılmıştır. Yeni atama yapılamaz.');
            }

            // Atanacak miktarı kontrol et (teslim edilmişlerin üzerine ekstra atama yapılabilir)
            // Bu iÃ…Å¸ emri tamamlanmadÃ„Â±Ã„Å¸Ã„Â± sÃƒÂ¼rece takip yapÃ„Â±lmaz, ancak mantÃ„Â±klÃ„Â± bir limit koymuyoruz
            // AtÃƒÂ¶lye adÃ„Â± baÃ…Å¸Ã„Â±na maksimum 2x iÃ…Å¸ emri miktarÃ„Â± atanabilir
            if (totalAssigned + parsedAssignedQuantity > workOrder.quantity * 2) {
                throw new Error(`Toplam atanan miktar (${totalAssigned + parsedAssignedQuantity}) iÃ…Å¸ emri miktarÃ„Â±nÃ„Â±n 2 katÃ„Â±nÃ„Â± (${workOrder.quantity * 2}) aÃ…Å¸amaz`);
            }

            // AtÃƒÂ¶lyeyi getir
            const workshop = await tx.fasonWorkshop.findUnique({
                where: { id: parsedWorkshopId }
            });

            if (!workshop) {
                throw new Error('AtÃƒÂ¶lye bulunamadÃ„Â±');
            }

            // DÄ±ÅŸ kaynak Ã¼retim tracking kaydÃ„Â± oluÃ…Å¸tur
            const assignment = await tx.fasonTracking.create({
                data: {
                    workOrderId: parsedWorkOrderId,
                    workshopId: parsedWorkshopId,
                    userId: user.id,
                    processType,
                    stepName,
                    status: ProcessStatus.BEKLIYOR,
                    assignedQuantity: parsedAssignedQuantity,
                    unitPrice: parsedUnitPrice,
                    totalPrice: parsedAssignedQuantity * parsedUnitPrice,
                    notes: typeof notes === 'string' ? notes : null
                } satisfies Prisma.FasonTrackingUncheckedCreateInput,
                include: {
                    workOrder: true,
                    workshop: true,
                    user: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // AtÃƒÂ¶lye bakiyesini ve kapasitesini gÃƒÂ¼ncelle
            const totalEarnings = parsedAssignedQuantity * parsedUnitPrice;

            console.log(`ÄŸÅ¸â€™Â° AtÃƒÂ¶lye bilgileri gÃƒÂ¼ncelleniyor: workshopId=${parsedWorkshopId}, totalEarnings=${totalEarnings}, quantity=${parsedAssignedQuantity}`);
            console.log(`ÄŸÅ¸â€œÅ  Workshop capacity durumu: mevcut=${workshop.capacity}, maxCapacity=${workshop.maxCapacity}`);

            const updateData: Prisma.FasonWorkshopUpdateInput = {
                balance: {
                    increment: totalEarnings
                },
                totalEarnings: {
                    increment: totalEarnings
                }
            };

            // Kapasite azalÃ„Â±r (mal atandÃ„Â±Ã„Å¸Ã„Â±nda)
            // NOT: capacity = kalan/aÃƒÂ§Ã„Â±k kapasite. EÃ„Å¸er NULL ise baÃ…Å¸langÃ„Â±ÃƒÂ§ta maxCapacity'dir
            const currentCapacity = workshop.capacity ?? (workshop.maxCapacity || 500000);
            const newCapacity = currentCapacity - totalEarnings;

            updateData.capacity = Math.max(0, newCapacity); // Negatif yapma

            console.log(`ÄŸÅ¸â€œâ€° Kapasite: ${currentCapacity} Ã¢â€ â€™ ${newCapacity}`);

            await tx.fasonWorkshop.update({
                where: { id: parsedWorkshopId },
                data: updateData
            });

            console.log(`Ã¢Å“â€¦ AtÃƒÂ¶lye kapasitesi azaltÃ„Â±ldÃ„Â± (-${totalEarnings})`);

            // EÃ„Å¸er completeWorkOrder true ise, iÃ…Å¸ emrini TESLIM_EDILDI yap (%100)
            if (completeWorkOrder) {
                console.log(`Ã¢Å“â€¦ Ã„Â°Ã…Å¸ emri ${parsedWorkOrderId} tamamlanÃ„Â±yor (assignment oluÃ…Å¸turulurken)`);
                await tx.workOrder.update({
                    where: { id: parsedWorkOrderId },
                    data: {
                        status: 'TESLIM_EDILDI',
                        updatedAt: new Date()
                    }
                });
            }

            return assignment;
        });

        return res.status(201).json(successResponse(result));
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('ÄŸÅ¸â€™Â¥ Create assignment error:', error);
        if (message.includes('bulunamadÃ„Â±')) {
            return res.status(404).json(errorResponse(message, 'NOT_FOUND'));
        }
        if (message.includes('aÃ…Å¸amaz')) {
            return res.status(400).json(errorResponse(message, 'VALIDATION_ERROR'));
        }
        return res.status(500).json(errorResponse('Sunucu hatasÃ„Â±'));
    }
}

// AtamalarÃ„Â± listele
async function handleGetAssignments(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { workshopId, status } = req.query;
        const where: Prisma.FasonTrackingWhereInput = {};
        const statusValue = Array.isArray(status) ? status[0] : status;

        if (workshopId) where.workshopId = parseInt(workshopId as string);
        if (statusValue && Object.values(ProcessStatus).includes(statusValue as ProcessStatus)) {
            where.status = statusValue as ProcessStatus;
        }

        console.log('[assignments GET] Query params:', { workshopId, status });

        const assignments = await prisma.fasonTracking.findMany({
            where,
            include: {
                workOrder: true,
                workshop: true,
                user: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log('[assignments GET] Found assignments:', assignments.length);
        if (assignments.length > 0) {
            console.log('[assignments GET] First assignment:', {
                id: assignments[0].id,
                workOrderId: assignments[0].workOrderId,
                workshopId: assignments[0].workshopId
            });
        }

        return res.json(successResponse(assignments));
    } catch (error: unknown) {
        console.error('ÄŸÅ¸â€™Â¥ Get assignments error:', error);
        return res.status(500).json(errorResponse('Sunucu hatasÃ„Â±'));
    }
}

// Atama gÃƒÂ¼ncelle
async function handleUpdateAssignment(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { id } = req.query;
        const {
            assignedQuantity,
            unitPrice,
            processType,
            status,
            notes
        } = req.body;

        if (!id || !assignedQuantity || unitPrice === undefined) {
            return res.status(400).json(errorResponse('Eksik veya geÃƒÂ§ersiz parametreler', 'VALIDATION_ERROR'));
        }

        const parsedId = parseInt(id as string);
        const parsedAssignedQuantity = parseInt(assignedQuantity);
        const parsedUnitPrice = parseFloat(unitPrice);

        if (isNaN(parsedId) || isNaN(parsedAssignedQuantity) || isNaN(parsedUnitPrice)) {
            return res.status(400).json(errorResponse('GeÃƒÂ§ersiz sayÃ„Â± formatÃ„Â±', 'VALIDATION_ERROR'));
        }

        if (parsedAssignedQuantity <= 0 || parsedUnitPrice < 0) {
            return res.status(400).json(errorResponse('Miktar pozitif, fiyat sÃ„Â±fÃ„Â±r veya pozitif olmalÃ„Â±dÃ„Â±r', 'VALIDATION_ERROR'));
        }

        const result = await prisma.$transaction(async (tx) => {
            // Mevcut atamayÃ„Â± getir
            const existingAssignment = await tx.fasonTracking.findUnique({
                where: { id: parsedId },
                include: { workshop: true, workOrder: true }
            });

            if (!existingAssignment) {
                throw new Error('Atama bulunamadÃ„Â±');
            }

            const oldTotalPrice = (existingAssignment.assignedQuantity || 0) * (existingAssignment.unitPrice || 0);
            const newTotalPrice = parsedAssignedQuantity * parsedUnitPrice;
            const priceDifference = newTotalPrice - oldTotalPrice;

            // AtamayÃ„Â± gÃƒÂ¼ncelle
            const assignment = await tx.fasonTracking.update({
                where: { id: parsedId },
                data: {
                    assignedQuantity: parsedAssignedQuantity,
                    unitPrice: parsedUnitPrice,
                    totalPrice: newTotalPrice,
                    processType,
                    status,
                    notes,
                    updatedAt: new Date()
                } satisfies Prisma.FasonTrackingUncheckedUpdateInput,
                include: {
                    workOrder: true,
                    workshop: true,
                    user: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // AtÃƒÂ¶lye bakiyesini ve kapasitesini gÃƒÂ¼ncelle
            if (priceDifference !== 0 && existingAssignment.workshopId) {
                console.log(`ÄŸÅ¸â€™Â° Atama fiyatÃ„Â± gÃƒÂ¼ncellenecek: workshopId=${existingAssignment.workshopId}, priceDifference=${priceDifference}`);

                await tx.fasonWorkshop.update({
                    where: { id: existingAssignment.workshopId },
                    data: {
                        balance: {
                            increment: priceDifference
                        },
                        totalEarnings: {
                            increment: priceDifference
                        },
                        // Kapasite da deÃ„Å¸iÃ…Å¸ir (fiyat farkÃ„Â± kadar)
                        capacity: {
                            increment: priceDifference
                        }
                    }
                });

                console.log(`Ã¢Å“â€¦ AtÃƒÂ¶lye kapasitesi gÃƒÂ¼ncellendi (${priceDifference > 0 ? '+' : ''}${priceDifference})`);
            }

            return assignment;
        });

        return res.json(successResponse(result));
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('ÄŸÅ¸â€™Â¥ Update assignment error:', error);
        if (message.includes('bulunamadÃ„Â±')) {
            return res.status(404).json(errorResponse(message, 'NOT_FOUND'));
        }
        return res.status(500).json(errorResponse('Sunucu hatasÃ„Â±'));
    }
}

// Atama sil
async function handleDeleteAssignment(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json(errorResponse('ID gerekli', 'VALIDATION_ERROR'));
        }

        const parsedId = parseInt(id as string);
        if (isNaN(parsedId)) {
            return res.status(400).json(errorResponse('GeÃƒÂ§ersiz ID', 'VALIDATION_ERROR'));
        }

        const result = await prisma.$transaction(async (tx) => {
            // AtamayÃ„Â± getir
            const assignment = await tx.fasonTracking.findUnique({
                where: { id: parsedId },
                include: { workshop: true }
            });

            if (!assignment) {
                throw new Error('Atama bulunamadÃ„Â±');
            }

            // AtÃƒÂ¶lye bakiyesini ve kapasitesini geri al
            const totalPrice = (assignment.assignedQuantity || 0) * (assignment.unitPrice || 0);
            if (assignment.workshopId) {
                console.log(`ÄŸÅ¸â€™Â° Atama silinecek - AtÃƒÂ¶lye bilgileri geri alÃ„Â±nÃ„Â±yor: workshopId=${assignment.workshopId}, totalPrice=${totalPrice}`);

                await tx.fasonWorkshop.update({
                    where: { id: assignment.workshopId },
                    data: {
                        balance: {
                            decrement: totalPrice
                        },
                        totalEarnings: {
                            decrement: totalPrice
                        },
                        // Kapasite azalÃ„Â±r (atama silindiÃ„Å¸inde)
                        capacity: {
                            decrement: totalPrice
                        }
                    }
                });

                console.log(`Ã¢Å“â€¦ AtÃƒÂ¶lye kapasitesi azaltÃ„Â±ldÃ„Â± (-${totalPrice})`);
            }

            // AtamayÃ„Â± sil
            await tx.fasonTracking.delete({
                where: { id: parsedId }
            });

            return { message: 'Assignment deleted successfully' };
        });

        return res.json(successResponse(result));
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('ÄŸÅ¸â€™Â¥ Delete assignment error:', error);
        if (message.includes('bulunamadÃ„Â±')) {
            return res.status(404).json(errorResponse(message, 'NOT_FOUND'));
        }
        return res.status(500).json(errorResponse('Sunucu hatasÃ„Â±'));
    }
}

// Atamadan teslim al (AtÃƒÂ¶lyede iÃ…Å¸lem bittiÃ„Å¸inde)
async function handlePatchAssignment(req: NextApiRequest, res: NextApiResponse, user: TokenPayload) {
    try {
        const { action, id, receivedQuantity, completeWorkOrder } = req.body;

        console.log('ÄŸÅ¸â€Â PATCH request body:', { action, id, receivedQuantity, completeWorkOrder });

        if (!id || !action) {
            return res.status(400).json(errorResponse('ID ve action gerekli', 'VALIDATION_ERROR'));
        }

        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            return res.status(400).json(errorResponse('GeÃƒÂ§ersiz ID', 'VALIDATION_ERROR'));
        }

        if (action === 'receive') {
            // AtÃƒÂ¶lyeden teslim al
            return await receiveFromWorkshop(req, res, user, parsedId);
        } else {
            return res.status(400).json(errorResponse('Bilinmeyen action', 'VALIDATION_ERROR'));
        }
    } catch (error: unknown) {
        console.error('ÄŸÅ¸â€™Â¥ Patch assignment error:', error);
        return res.status(500).json(errorResponse('Sunucu hatasÃ„Â±'));
    }
}

// AtÃƒÂ¶lyeden mal teslim al
async function receiveFromWorkshop(req: NextApiRequest, res: NextApiResponse, _user: TokenPayload, assignmentId: number) {
    try {
        const { receivedQuantity, completeWorkOrder, pickupDate, deliveryDate } = req.body;

        console.log(`ÄŸÅ¸â€â€ receiveFromWorkshop called - assignmentId: ${assignmentId}, completeWorkOrder: ${completeWorkOrder}, receivedQuantity: ${receivedQuantity}, pickupDate: ${pickupDate}, deliveryDate: ${deliveryDate}`);

        const result = await prisma.$transaction(async (tx) => {
            // AtamayÃ„Â± getir
            const assignment = await tx.fasonTracking.findUnique({
                where: { id: assignmentId },
                include: { workOrder: true, workshop: true }
            });

            if (!assignment) {
                throw new Error('Atama bulunamadÃ„Â±');
            }

            if (assignment.status !== ProcessStatus.BEKLIYOR && assignment.status !== 'ATÖLYEDE') {
                throw new Error('Bu atamadan teslim alamazsÃ„Â±nÃ„Â±z (Durum: ' + assignment.status + ')');
            }

            // receivedQuantity varsa kontrol et
            const assignedQty = assignment.assignedQuantity || 0;
            const receivedQty = receivedQuantity !== undefined ? parseInt(receivedQuantity) : assignedQty;
            if (isNaN(receivedQty) || receivedQty <= 0 || receivedQty > assignedQty) {
                throw new Error(`Teslim alÃ„Â±nacak miktar 1 ile ${assignedQty} arasÃ„Â±nda olmalÃ„Â±dÃ„Â±r`);
            }
            // AtamayÃ„Â± TESLIM_EDILDI olarak gÃƒÂ¼ncelle
            const updatedAssignment = await tx.fasonTracking.update({
                where: { id: assignmentId },
                data: {
                    status: 'TESLIM_EDILDI',
                    endDate: new Date(),
                    // receivedQuantity varsa kaydet, yoksa assignedQuantity'yi kullan
                    receivedQuantity: receivedQty,
                    updatedAt: new Date(),
                    // Tarih alanlarÃ„Â±nÃ„Â± kaydet
                    ...(pickupDate && {
                        pickupDate: new Date(pickupDate)
                    }),
                    ...(deliveryDate && {
                        deliveryDate: new Date(deliveryDate)
                    })
                },
                include: {
                    workOrder: true,
                    workshop: true,
                    user: { select: { id: true, name: true } }
                }
            });

            // AtÃƒÂ¶lyenin kapasitesini gÃƒÂ¼ncelle
            if (assignment.workshop && assignment.workshopId) {

                // AlÃ„Â±nan mal tutarÃ„Â±nÃ„Â± (unitPrice * receivedQuantity) kapasite azaltmasÃ„Â±nda kullan
                // Atama sırasında düşülen tutar kadar kapasite geri açılır (assignedQty * unitPrice)
                const capacityDeduction = assignedQty * (assignment.unitPrice ?? 0);

                console.log(`ÄŸÅ¸â€™Â° AtÃƒÂ¶lye kapasitesi gÃƒÂ¼ncelleniyor: workshopId=${assignment.workshopId}, deduction=${capacityDeduction}`);

                // Workshop kapasitesini azalt
                // Kapasite maxCapacity'yi geçmez
                const currentWorkshopCapacity =
                    assignment.workshop.capacity ?? (assignment.workshop.maxCapacity || 500000);
                const reopenedCapacity = Math.min(
                    assignment.workshop.maxCapacity || 500000,
                    currentWorkshopCapacity + capacityDeduction
                );
                await tx.fasonWorkshop.update({
                    where: { id: assignment.workshopId },
                    data: { capacity: reopenedCapacity }
                });

                console.log(`Ã¢Å“â€¦ AtÃƒÂ¶lye kapasitesi gÃƒÂ¼ncellendi`);
            }

            // Ã„Â°Ã…Å¸ emrinin diÃ„Å¸er atamalarÃ„Â±nÃ„Â± kontrol et
            const otherAssignments = await tx.fasonTracking.findMany({
                where: {
                    workOrderId: assignment.workOrderId,
                    id: { not: assignmentId }
                }
            });

            // HenÃƒÂ¼z atanmamÃ„Â±Ã…Å¸ bir atama var mÃ„Â± kontrol et
            const hasNextAssignment = otherAssignments.some(a => a.status === 'BEKLIYOR');

            let workOrderCompleted = false;

            // EÃ„Å¸er completeWorkOrder true ise, iÃ…Å¸ emrini TESLIM_EDILDI yap (%100)
            if (completeWorkOrder) {
                console.log(`Ã¢Å“â€¦ Ã„Â°Ã…Å¸ emri ${assignment.workOrderId} tamamlanÃ„Â±yor (completeWorkOrder=true)`);
                await tx.workOrder.update({
                    where: { id: assignment.workOrderId },
                    data: {
                        status: 'TESLIM_EDILDI',
                        updatedAt: new Date()
                    }
                });
                workOrderCompleted = true;
            }

            return {
                assignment: updatedAssignment,
                hasNextAssignment,
                workOrderCompleted,
                message: `Mal atÃƒÂ¶lyeden teslim alÃ„Â±ndÃ„Â± (${receivedQty} adet)`
            };
        });

        return res.json(successResponse(result));
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('ÄŸÅ¸â€™Â¥ Receive from workshop error:', error);
        if (message.includes('bulunamadÃ„Â±')) {
            return res.status(404).json(errorResponse(message, 'NOT_FOUND'));
        }
        if (message.includes('teslim alamazsÃ„Â±nÃ„Â±z')) {
            return res.status(400).json(errorResponse(message, 'INVALID_STATE'));
        }
        if (message.includes('arasÃ„Â±nda')) {
            return res.status(400).json(errorResponse(message, 'VALIDATION_ERROR'));
        }
        return res.status(500).json(errorResponse('Sunucu hatasÃ„Â±'));
    }
}

export default withCors(handler);




