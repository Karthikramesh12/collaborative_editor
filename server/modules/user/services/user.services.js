const prisma = require('../../../config/prisma.js');

async function searchUser(query, userId) {
    if (!query || query.lenght < 2 ) return [];

    return prisma.user.findMany({
        where:{
            AND:[
                { isActive: true },
                { id: { not: userId }},
                {
                    OR:[
                        { email: {startsWith: query, mode:'insensitive'}},
                        {name: {startsWith: query, mode:'insensitive'}}
                    ]
                }
            ]
        },
        select:{
            id: true, 
            name: true,
            email: true,
            avatarUrl: true
        },
        take: 10
    });
}

module.exports = {
    searchUser,
}