'use strict';

var myArgs = process.argv.slice(2),
    async = require('async');

function requestSoapCardInfoXml(cardNumber, callback) {
    var soap = require('soap'),
        url  = 'http://www.citram.es:50081/VENTAPREPAGOTITULO/VentaPrepagoTitulo.svc?wsdl';

    soap.createClient(url, function (err, client) {
        if (err) {
            callback(err);
        }
        var args = {
            sNumeroTP: cardNumber,
            sLenguaje: "es",
            sTipoApp: "APP_SALDO_ANDROID"
        };

        client.ConsultaSaldoTarjeta1(args, function (err, result) {
            if (err) {
                callback(err);
            } else {
                callback(null, result.ConsultaSaldoTarjeta1Result.sResulXMLField);
            }
        });
    });
}

function getCliCardId() {
    if (myArgs.length < 1) {
        return "0010010287871";
    }
    return myArgs[0];
}

function extractCardInfo(data, callback) {
    var cardInfo = [];

    try {
        data['consulta-saldo'].titulos.forEach(function (tituloWrapper) {
            var cardInfoItem = {},
                titulo = tituloWrapper.titulo[0];

            if (!titulo.carga) {
                return;
            }

            var dataSection = titulo.data,
                cargaSection = titulo.carga[0].data;

            dataSection.forEach(function (item) {
                switch (item.$.name) {
                case 'ContractName':
                    cardInfoItem.titleName = item.$.value;
                    break;
                case 'ContractUserProfileTypeName':
                    cardInfoItem.type = item.$.value;
                    break;
                }
            });

            cardInfoItem.charge = {};
            cargaSection.forEach(function (item) {
                switch (item.$.name) {
                case 'ContractChargeDate':
                    cardInfoItem.charge.chargeDate = item.$.value;
                    break;
                case 'ContractChargeStartDate':
                    cardInfoItem.charge.validStartDate = item.$.value;
                    break;
                case 'ContractChargeEndDate':
                    cardInfoItem.charge.validEndDate = item.$.value;
                    break;
                case 'ChargeFirstUseDate':
                    cardInfoItem.charge.lastDateForFirstAccess = item.$.value;
                    break;
                case 'AccessEventInFirstPayDateCe':
                    cardInfoItem.charge.firstAccessDate = item.$.value;
                    break;
                case 'ChargeEndDate':
                    cardInfoItem.charge.expireDate = item.$.value;
                    break;
                }
            });
            cardInfo.push(cardInfoItem);
        });
    } catch (e) {
        callback(Error('Error parsing XML'));
    }

    callback(null, cardInfo);
}

var parseXml = function (xml, callback) {

    var parseString = require('xml2js').parseString;
    parseString(xml, function (err, result) {
        callback(err, result);
    });
};

function getCardInfo() {
    var calls = [];

    calls.push(function (callback) {
        requestSoapCardInfoXml(getCliCardId(), callback);
    });

    calls.push(function (xml, callback) {
        parseXml(xml, callback);
    });

    calls.push(function (parsed, callback) {
        extractCardInfo(parsed, callback);
    });

    calls.push(function (cardInfo, callback) {
        console.log(cardInfo);
        callback();
    });

    async.waterfall(calls, function (err) {
        if (err) {
            console.log('::::ERROR:::: ' + err);
        }
    });
}

getCardInfo();
